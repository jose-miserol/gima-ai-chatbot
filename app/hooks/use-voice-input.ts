/**
 * @file use-voice-input.ts
 * @module app/hooks/use-voice-input
 *
 * ============================================================
 * HOOK — ENTRADA DE VOZ MULTIMODAL CON FALLBACK AUTOMÁTICO
 * ============================================================
 *
 * QUÉ HACE ESTE HOOK:
 *   Abstrae completamente la captura y transcripción de voz del usuario.
 *   Implementa un sistema de dos modos con fallback automático:
 *
 *   MODO GEMINI (primario):
 *     Graba audio con la API MediaRecorder del navegador, lo convierte a
 *     base64 y lo envía a la Server Action `transcribeAudio()` que usa
 *     Gemini Flash Lite. Produce transcripciones de alta calidad en español
 *     técnico (siglas GIMA, terminología de mantenimiento).
 *
 *   MODO NATIVO (fallback):
 *     Usa la Web Speech API del navegador directamente (sin llamada al servidor).
 *     Se activa automáticamente cuando Gemini no está disponible (cuota agotada,
 *     sin conexión, API key no configurada, o navegador sin MediaRecorder).
 *     Menor calidad pero funciona offline y en Safari/iOS.
 *
 * CUÁNDO SE ACTIVA EL FALLBACK:
 *   - Error de cuota de Gemini (429)
 *   - API key no configurada (GOOGLE_GENERATIVE_AI_API_KEY ausente)
 *   - Sin conexión a internet (navigator.onLine === false)
 *   - MIME type de audio no soportado por el navegador
 *   - MediaRecorder no disponible (navegadores antiguos)
 *
 * DIAGRAMA DE FLUJO:
 *   [toggleListening()]
 *   - mode === 'gemini'
 *   [MediaRecorder.start()] → graba chunks de audio
 *   - [toggleListening()] o [stop()]
 *   [MediaRecorder.stop()] → dispara `onstop`
 *   [FileReader.readAsDataURL()] → convierte blob a base64
 *   [transcribeAudio(base64, mimeType)] → Server Action → Gemini
 *   - éxito
 *   [onTranscript(text)] → callback al componente padre
 *   - error
 *   [simplifyGeminiError()] → mensaje amigable → fallback a modo nativo
 *
 * GESTIÓN DE RECURSOS:
 *   - MediaStream: se libera (.stop() en cada track) tras transcribir.
 *   - SpeechRecognition: se aborta en cleanup del useEffect.
 *   - AbortController: cancela la transcripción en vuelo si el usuario
 *     detiene la grabación antes de que la API responda.
 *
 * DÓNDE SE USA:
 *   - Componente VoiceRecorder en app/components/features/voice/
 *   - Componente ChatInput para dictar mensajes al chat
 * ============================================================
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

// Server Action que llama a Gemini Flash Lite para transcribir audio base64
import { transcribeAudio } from '@/app/actions';

// Mensajes de UI centralizados y longitud máxima de error para truncado
import { VOICE_MESSAGES, MAX_ERROR_MESSAGE_LENGTH } from '@/app/constants/messages';

// Logger estructurado del proyecto
import { logger } from '@/app/lib/logger';

// Detecta dinámicamente el MIME type de audio soportado por el navegador actual
// (chrome: webm/opus, safari: mp4, firefox: ogg/opus, etc.)
import { getSupportedAudioMimeType } from '@/app/utils/media-types';

// ============================================================
// INTERFACES DE CONFIGURACIÓN Y RETORNO
// ============================================================

/**
 * Opciones de configuración del hook.
 * Todos los campos son opcionales para facilitar su uso básico.
 */
interface UseVoiceInputOptions {
  /** Callback invocado cuando la transcripción completa. Recibe el texto limpio. */
  onTranscript?: (text: string) => void;
  /** Callback invocado cuando ocurre un error (mensaje ya formateado para el usuario). */
  onError?: (error: string) => void;
  /** Callback para sincronizar el estado del hook con la UI padre. */
  onStateChange?: (state: 'listening' | 'processing' | 'idle') => void;
  /** Código de idioma BCP 47. Default 'es-ES' para técnicos hispanohablantes. */
  language?: string;
}

/**
 * Objeto retornado por el hook con estado y controles de voz.
 */
interface UseVoiceInputReturn {
  /** true mientras MediaRecorder o SpeechRecognition están activos */
  isListening: boolean;
  /** true mientras se espera respuesta de Gemini (entre stop y transcript) */
  isProcessing: boolean;
  /** Texto transcrito más reciente. Se limpia al iniciar nueva grabación. */
  transcript: string;
  /** false si ni MediaRecorder ni SpeechRecognition están disponibles en el navegador */
  isSupported: boolean;
  /** Modo activo actualmente: 'gemini' (alta calidad) o 'native' (fallback) */
  mode: 'gemini' | 'native';
  /** Alterna entre iniciar y detener la grabación. No hace nada si isProcessing === true */
  toggleListening: () => void;
  /** Limpia el transcript actual (útil tras enviar el comando al chat) */
  resetTranscript: () => void;
  /** Mensaje de error actual en formato amigable para el usuario, o null si no hay error */
  error: string | null;
}

// ============================================================
// INTERFACES DE LA WEB SPEECH API
// ============================================================
// Definiciones locales para evitar conflictos con tipos globales de @types/web.
// La Web Speech API no tiene definiciones de TypeScript oficiales estables.

interface ISpeechRecognitionEvent extends Event {
  results: ISpeechRecognitionResultList;
  resultIndex: number;
}

interface ISpeechRecognitionResultList {
  length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

interface ISpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: ISpeechRecognitionAlternative;
}

interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (event: Event) => void;
  onresult: (event: ISpeechRecognitionEvent) => void;
  onerror: (event: ISpeechRecognitionErrorEvent) => void;
  onend: (event: Event) => void;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

// ============================================================
// UTILIDADES DE MÓDULO
// ============================================================

/**
 * Obtiene el constructor de SpeechRecognition de forma segura.
 *
 * POR QUÉ FUNCIÓN Y NO ACCESO DIRECTO:
 *   - Evita errores de SSR (window no existe en el servidor Next.js).
 *   - Maneja el prefijo `webkit` de Chrome/Safari de forma transparente.
 *   - Retorna null si no está disponible, sin lanzar excepciones.
 */
const getSpeechRecognition = (): ISpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
};

/**
 * Convierte errores técnicos de Gemini en mensajes amigables para el usuario.
 *
 * QUÉ HACE:
 *   Mapea mensajes de error de la API de Google (en inglés, técnicos) a mensajes
 *   cortos con emoji que el técnico puede entender de un vistazo.
 *   Todos los mensajes del catálogo `VOICE_MESSAGES` incluyen "· Modo local activo"
 *   cuando corresponde, indicando que el fallback nativo está disponible.
 *
 * ESTRATEGIA DE MATCHING:
 *   Se usa `.toLowerCase()` + `.includes()` en lugar de regex o comparaciones exactas
 *   porque los mensajes de error de la API de Google varían entre versiones y regiones.
 *   La búsqueda por substring es más robusta ante cambios del proveedor.
 *
 * @param error - Mensaje de error de la API o de la Server Action (puede ser undefined).
 * @returns Mensaje amigable de VOICE_MESSAGES, o el error original truncado con prefijo ⚠️.
 */
const simplifyGeminiError = (error?: string): string => {
  if (!error) return VOICE_MESSAGES.LOCAL_MODE;
  const lowerError = error.toLowerCase();

  logger.debug('Gemini transcription error', { error: lowerError, component: 'useVoiceInput' });

  // Cuota agotada o rate limit → el usuario debe esperar o usar modo nativo
  if (
    lowerError.includes('quota') ||
    lowerError.includes('exceeded') ||
    lowerError.includes('rate limit')
  ) {
    return VOICE_MESSAGES.QUOTA_EXCEEDED;
  }

  // API key incorrecta o ausente → problema de configuración del servidor
  if (
    lowerError.includes('api key') ||
    lowerError.includes('api_key') ||
    lowerError.includes('invalid key')
  ) {
    return VOICE_MESSAGES.API_NOT_CONFIGURED;
  }

  // Error de red → sin conexión al servidor de Gemini
  if (
    lowerError.includes('network') ||
    lowerError.includes('fetch') ||
    lowerError.includes('connection')
  ) {
    return VOICE_MESSAGES.NO_CONNECTION;
  }

  // Timeout → la transcripción tardó más del límite (AI_TIMEOUTS.QUICK = 10s)
  if (lowerError.includes('timeout')) {
    return VOICE_MESSAGES.TIMEOUT;
  }

  // Error de formato/codec de audio → MIME type incompatible con Gemini
  if (
    lowerError.includes('audio') ||
    lowerError.includes('media') ||
    lowerError.includes('format')
  ) {
    return VOICE_MESSAGES.AUDIO_ERROR;
  }

  // Error interno del servidor (500)
  if (
    lowerError.includes('500') ||
    lowerError.includes('server error') ||
    lowerError.includes('internal')
  ) {
    return VOICE_MESSAGES.SERVER_ERROR;
  }

  // Modelo de Gemini no disponible temporalmente
  if (
    lowerError.includes('models/') &&
    (lowerError.includes('not found') || lowerError.includes('is not'))
  ) {
    return VOICE_MESSAGES.MODEL_NOT_AVAILABLE;
  }

  // Fallback: mostrar el error original truncado para debugging
  // MAX_ERROR_MESSAGE_LENGTH (30) previene overflow en la UI
  const shortError =
    error.length > MAX_ERROR_MESSAGE_LENGTH
      ? error.substring(0, MAX_ERROR_MESSAGE_LENGTH) + '...'
      : error;
  return `⚠️ ${shortError} · Modo local activo`;
};

// ============================================================
// HOOK PRINCIPAL
// ============================================================

/**
 * Hook de entrada de voz multimodal con fallback automático a Web Speech API.
 *
 * QUÉ HACE:
 *   Gestiona todo el ciclo de vida de la captura de voz: permisos de micrófono,
 *   grabación, transcripción, manejo de errores y cambio automático de modo.
 *   Expone una interfaz simple (toggleListening + transcript) que oculta
 *   toda la complejidad del doble sistema de transcripción.
 *
 * DETECCIÓN DE CAPACIDADES (useEffect al montar):
 *   Al montar el componente, detecta si el navegador tiene MediaRecorder
 *   y/o SpeechRecognition disponibles. Selecciona el modo óptimo:
 *   - MediaRecorder + online → modo 'gemini' (alta calidad)
 *   - Solo SpeechRecognition → modo 'native' (fallback)
 *   - Ninguno → isSupported = false (deshabilitar el botón de voz en UI)
 *
 * @param options - Configuración del hook (todos opcionales).
 * @returns Estado y controles de voz.
 *
 * @example
 * ```tsx
 * function ChatInput() {
 *   const { isListening, isProcessing, transcript, toggleListening, mode, error } =
 *     useVoiceInput({
 *       onTranscript: (text) => setInputValue(text),
 *       language: 'es-ES',
 *     });
 *
 *   return (
 *     <div>
 *       <button onClick={toggleListening} disabled={isProcessing}>
 *         {isListening ? '⏹ Detener' : '🎤 Grabar'} ({mode})
 *       </button>
 *       {error && <span className="text-red-500">{error}</span>}
 *       <p>{transcript}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useVoiceInput({
  onTranscript,
  onError,
  onStateChange,
  language = 'es-ES',
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  // --- Estado reactivo ---
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'gemini' | 'native'>('gemini');
  const [isSupported, setIsSupported] = useState(false);

  // --- Refs (valores que no causan re-render) ---
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const chunksRef = useRef<Blob[]>([]); // Acumula fragmentos de audio del MediaRecorder
  const streamRef = useRef<MediaStream | null>(null); // Para liberar la cámara/mic al terminar
  const abortControllerRef = useRef<AbortController | null>(null); // Para cancelar transcripción en vuelo

  // ============================================================
  // EFECTO: Detección de capacidades del navegador al montar
  // ============================================================
  // Se ejecuta solo una vez (array vacío). Establece `isSupported` y `mode`
  // iniciales según lo que el navegador actual soporta.
  useEffect(() => {
    const hasMediaRecorder = typeof window !== 'undefined' && !!window.MediaRecorder;
    const hasSpeechRecognition = !!getSpeechRecognition();

    setIsSupported(hasMediaRecorder || hasSpeechRecognition);

    // Preferir Gemini si MediaRecorder está disponible Y hay conexión a internet
    if (hasMediaRecorder && navigator.onLine) {
      setMode('gemini');
    } else if (hasSpeechRecognition) {
      setMode('native');
    }
    // Si ninguno: isSupported queda false → el componente padre deshabilita el botón
  }, []);

  // ============================================================
  // MODO GEMINI: Grabación con MediaRecorder
  // ============================================================

  /**
   * Inicia la grabación de audio con MediaRecorder para enviar a Gemini.
   *
   * FLUJO INTERNO:
   *   1. Solicita permiso de micrófono (getUserMedia). Si falla → fallback nativo.
   *   2. Detecta el MIME type de audio soportado por el navegador.
   *   3. Crea un MediaRecorder que acumula chunks de audio en `chunksRef`.
   *   4. Al detener, convierte los chunks a base64 y llama a `transcribeAudio()`.
   *   5. Si Gemini falla, muestra error amigable y cambia a modo nativo.
   *
   * POR QUÉ AbortController:
   *   El usuario puede detener la grabación antes de que Gemini responda.
   *   Sin AbortController, la transcripción llegaría después y sobreescribiría
   *   el estado del componente con datos ya descartados por el usuario.
   */
  const startGeminiRecording = useCallback(async () => {
    try {
      // Solicitar acceso al micrófono. Lanza NotAllowedError si el usuario deniega.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Detectar MIME type dinámicamente (Chrome vs Safari vs Firefox)
      let mimeType: string;
      try {
        mimeType = getSupportedAudioMimeType();
        logger.debug('Using audio MIME type', {
          mimeType,
          userAgent: navigator.userAgent,
          component: 'useVoiceInput',
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to get supported MIME type', new Error(errorMsg), {
          component: 'useVoiceInput',
          userAgent: navigator.userAgent,
        });
        // Si el MIME type falla → el navegador no soporta ningún formato de audio
        // compatible con MediaRecorder → activar fallback nativo
        setMode('native');
        startNativeListening();
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = []; // Limpiar chunks de grabaciones anteriores

      // Acumular fragmentos de audio conforme llegan del codec
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // Cuando el recorder se detiene: procesar y transcribir el audio acumulado
      recorder.onstop = async () => {
        setIsListening(false);
        setIsProcessing(true);
        onStateChange?.('processing');

        // Unir todos los chunks en un solo Blob con el MIME type correcto
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64Audio = reader.result as string; // Formato: "data:audio/webm;base64,..."

          try {
            // Crear AbortController para poder cancelar si el usuario actúa de nuevo
            abortControllerRef.current = new AbortController();

            // Llamar a la Server Action que envía el audio a Gemini Flash Lite
            const result = await transcribeAudio(base64Audio, mimeType);

            // Si el usuario canceló mientras esperábamos → descartar resultado
            if (abortControllerRef.current?.signal.aborted) {
              logger.debug('Transcription cancelled by user', { component: 'useVoiceInput' });
              return;
            }

            if (result.success && result.text) {
              setTranscript(result.text);
              onTranscript?.(result.text);
              setError(null);
            } else {
              throw new Error(result.error || 'Error desconocido');
            }
          } catch (err: unknown) {
            const hasSpeechRecognition = !!getSpeechRecognition();

            if (hasSpeechRecognition) {
              // Si el navegador tiene Web Speech API → mostrar error + activar fallback
              const errorMessage = err instanceof Error ? err.message : String(err);
              const userFriendlyError = simplifyGeminiError(errorMessage);
              setError(userFriendlyError);
              onError?.(userFriendlyError);
              setMode('native'); // Las siguientes grabaciones usarán modo nativo
            } else {
              // Sin alternativa → informar que el navegador no tiene soporte suficiente
              const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
              setError(errorMsg);
              onError?.(errorMsg);
            }
          }

          setIsProcessing(false);
          onStateChange?.('idle');

          // Liberar el MediaStream para apagar el indicador de micrófono en el navegador
          streamRef.current?.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        };

        reader.readAsDataURL(blob); // Convierte el Blob a base64 (dispara onloadend)
      };

      recorder.start(); // Inicia la grabación (dispara ondataavailable periódicamente)
      setIsListening(true);
      onStateChange?.('listening');
      setError(null);
    } catch (err) {
      // getUserMedia falló (permisos denegados, sin micrófono) → intentar modo nativo
      setMode('native');
      startNativeListening();
    }
  }, [onTranscript, onError, onStateChange]);

  /**
   * Detiene la grabación Gemini y cancela cualquier transcripción en vuelo.
   * Llamar a `recorder.stop()` dispara el handler `onstop` que procesa el audio.
   */
  const stopGeminiRecording = useCallback(() => {
    // Cancelar transcripción pendiente si existe (el usuario detuvo antes de recibir respuesta)
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop(); // Dispara `onstop` → procesa el audio acumulado
    }
  }, []);

  // ============================================================
  // MODO NATIVO: Web Speech API del navegador
  // ============================================================

  /**
   * Inicia el reconocimiento de voz usando la Web Speech API nativa.
   *
   * DIFERENCIAS CON GEMINI:
   *   - No hay llamada al servidor: todo ocurre en el navegador.
   *   - Los resultados llegan en tiempo real (interim results) mientras habla.
   *   - Calidad variable según el motor del navegador (mejor en Chrome).
   *   - Limitado a idiomas soportados por el navegador (no el modelo).
   *
   * POR QUÉ continuous: true E interimResults: true:
   *   `continuous: true` evita que el reconocimiento se detenga automáticamente
   *   tras una pausa breve (los técnicos hablan con pausas entre términos).
   *   `interimResults: true` muestra el texto mientras el usuario habla,
   *   dando feedback visual inmediato.
   *
   * MANEJO DE ERRORES ESPECIALES:
   *   - 'no-speech': se ignora (ocurre frecuentemente sin ser un error real).
   *   - 'not-allowed': permisos denegados → error definitivo, no recuperable.
   *   - 'aborted': ocurre al llamar .abort() programáticamente → se ignora.
   *   - Si `didStart` es false al recibir onerror/onend: el navegador no soporta
   *     la API aunque exista el constructor (browsers con API incompleta).
   */
  const startNativeListening = useCallback(() => {
    setError(null);
    const SpeechRecognition = getSpeechRecognition();

    if (!SpeechRecognition) {
      const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
      setError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    // Limpiar instancia anterior si existe (evita listeners duplicados)
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignorar errores al abortar una instancia ya terminada
      }
    }

    // Flag para detectar si la API realmente comenzó a escuchar.
    // Algunos navegadores tienen el constructor pero no la implementación completa.
    let didStart = false;

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // No parar automáticamente en silencios
    recognition.interimResults = true; // Mostrar texto en tiempo real
    recognition.lang = language; // Idioma BCP 47 (default: 'es-ES')
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      didStart = true;
      setIsListening(true);
      onStateChange?.('listening');
      setError(null);
    };

    // Reconstruir el transcript completo desde cero en cada evento.
    // POR QUÉ: Acumular solo results[resultIndex] produce duplicados porque
    // la Web Speech API puede revisitar resultados anteriores.
    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        // Incluir tanto resultados finales como intermedios para feedback inmediato
        fullTranscript += event.results[i][0].transcript;
      }
      if (fullTranscript) {
        setTranscript(fullTranscript);
        onTranscript?.(fullTranscript);
      }
    };

    recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return; // Silencio detectado → no es un error real

      if (event.error === 'not-allowed') {
        // El usuario denegó el micrófono → error definitivo
        setError(VOICE_MESSAGES.PERMISSION_DENIED);
        onError?.(VOICE_MESSAGES.PERMISSION_DENIED);
      } else if (event.error !== 'aborted') {
        // Si no inició correctamente → navegador sin soporte real
        if (!didStart) {
          const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
          setError(errorMsg);
          onError?.(errorMsg);
        } else {
          // Error durante la grabación activa → mostrar el código de error nativo
          setError(`${VOICE_MESSAGES.VOICE_ERROR_PREFIX} ${event.error}`);
          onError?.(`${VOICE_MESSAGES.VOICE_ERROR_PREFIX} ${event.error}`);
        }
      }
      setIsListening(false);
      onStateChange?.('idle');
    };

    recognition.onend = () => {
      // Si nunca inició (`didStart` es false) → el navegador rechazó la API silenciosamente
      if (!didStart) {
        const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
        setError(errorMsg);
        onError?.(errorMsg);
      }
      setIsListening(false);
      onStateChange?.('idle');
    };

    try {
      recognition.start();
    } catch (e) {
      // Excepción síncrona al iniciar → navegador sin soporte
      const errorMsg = VOICE_MESSAGES.BROWSER_NOT_SUPPORTED;
      setError(errorMsg);
      onError?.(errorMsg);
    }
  }, [language, onTranscript, onError, onStateChange]);

  /**
   * Detiene el reconocimiento nativo de forma controlada.
   * `.stop()` termina la sesión y dispara `onend` con los resultados finales.
   */
  const stopNativeListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignorar si ya estaba detenido
      }
    }
  }, []);

  // ============================================================
  // CONTROL MAESTRO: toggleListening
  // ============================================================

  /**
   * Alterna entre iniciar y detener la grabación de voz.
   *
   * LÓGICA:
   *   - Si está procesando (isProcessing) → no hace nada (esperar a Gemini).
   *   - Si está escuchando → detener el modo activo.
   *   - Si está en idle → limpiar transcript anterior e iniciar el modo activo.
   *   El modo activo (`mode`) se usa para despachar a la función correcta.
   *
   * POR QUÉ LIMPIAR TRANSCRIPT AL INICIAR:
   *   El transcript anterior pertenece al comando previo ya enviado.
   *   Al empezar una nueva grabación, el usuario espera empezar desde cero.
   */
  const toggleListening = useCallback(() => {
    if (isProcessing) return; // Bloquear mientras Gemini está procesando

    if (isListening) {
      if (mode === 'gemini') {
        stopGeminiRecording();
      } else {
        stopNativeListening();
      }
    } else {
      setTranscript(''); // Limpiar transcript del comando anterior
      if (mode === 'gemini') {
        startGeminiRecording();
      } else {
        startNativeListening();
      }
    }
  }, [
    isListening,
    isProcessing,
    mode,
    startGeminiRecording,
    stopGeminiRecording,
    startNativeListening,
    stopNativeListening,
  ]);

  /** Limpia el transcript actual. Llamar tras enviar el comando al chat. */
  const resetTranscript = useCallback(() => setTranscript(''), []);

  // ============================================================
  // EFECTO: Cleanup al desmontar el componente
  // ============================================================
  // Libera todos los recursos de audio para evitar memory leaks y
  // asegurar que el indicador de micrófono del navegador se apague.
  useEffect(() => {
    return () => {
      // Detener MediaRecorder si está activo
      if (mediaRecorderRef.current?.state !== 'inactive') {
        try {
          mediaRecorderRef.current?.stop();
        } catch {
          // Ignorar error si ya estaba inactivo
        }
      }
      // Liberar los tracks del micrófono (apaga el indicador de grabación del browser)
      streamRef.current?.getTracks().forEach((track) => track.stop());
      // Abortar reconocimiento nativo si está activo
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignorar
        }
      }
    };
  }, []); // Solo al desmontar

  return {
    isListening,
    isProcessing,
    transcript,
    isSupported,
    mode,
    toggleListening,
    resetTranscript,
    error,
  };
}
