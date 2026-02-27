# 14 — Feature: Sistema de Voz (`features/voice/`)

> El módulo de voz permite al usuario hablar en vez de escribir. Incluye grabación de audio, transcripción, y un modo especial de comandos para órdenes de trabajo.

---

## Flujo General

```
    ┌──────────────────────────────────────────────────────────┐
    │                  Flujo de Voz Normal                      │
    │                                                          │
    │  🎤 Click → Grabar → Click → Enviar a Gemini → Texto    │
    │                                                          │
    └──────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────┐
    │               Flujo de Comando de Voz                     │
    │                                                          │
    │  🎤 Click → Grabar → Click → Gemini → Parsear comando   │
    │                                         ↓                │
    │                                   Preview: "Crear OT     │
    │                                   urgente para UMA"      │
    │                                         ↓                │
    │                                [Ejecutar] [Cancelar]     │
    └──────────────────────────────────────────────────────────┘
```

---

## 📄 Archivos del Módulo

| Archivo                        | ¿Para qué?                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------- |
| `voice-button.tsx`             | Botón principal de grabación. Cambia de estado visual: idle → grabando → procesando |
| `voice-command-mode.tsx`       | Modo completo de comandos de voz con grabación + parsing + ejecución                |
| `command-preview.tsx`          | Preview visual del comando interpretado antes de confirmar                          |
| `command-status-indicator.tsx` | Indica el estado: "Escuchando...", "Procesando...", "¡Comando detectado!"           |
| `audio-waveform.tsx`           | Visualización animada de la onda de audio mientras grabas                           |
| `constants.ts`                 | Constantes del sistema de voz                                                       |
| `types.ts`                     | Tipos TypeScript del módulo                                                         |
| `index.ts`                     | Re-exportaciones públicas                                                           |
| `hooks/`                       | 3 hooks especializados del módulo de voz                                            |

---

## 🧠 Conceptos Clave

### ¿Qué es `MediaRecorder`?

Es una API del navegador que permite grabar audio/video del micrófono. El hook `use-voice-input` la usa internamente:

```
navigator.mediaDevices.getUserMedia({ audio: true })  // ← Pide permiso
  → new MediaRecorder(stream)                          // ← Crea grabador
  → recorder.start()                                   // ← Inicia grabación
  → recorder.stop()                                    // ← Para y genera blob
  → blob → base64 → Server Action: transcribeAudio()  // ← Envía a Gemini
```

### ¿Qué son los Commands?

Los comandos de voz son patrones reconocidos que disparan acciones:

| Lo que dices                                   | Acción resultante              |
| ---------------------------------------------- | ------------------------------ |
| "Crear orden urgente para la UMA del sector 3" | Crea OT con prioridad urgente  |
| "Mostrar órdenes pendientes"                   | Lista OTs con status pendiente |
| "Verificar estado de la BCA"                   | Consulta equipo BCA            |
| "Asignar orden al técnico Carlos"              | Asigna técnico a OT            |

---

**← Anterior**: [13 — Feature: Chat](./13-feature-chat.md) | **Siguiente**: [15 — Feature: AI Tools](./15-feature-ai-tools.md) →
