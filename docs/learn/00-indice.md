# 📘 Índice de Documentación — GIMA AI Chatbot

> **¿Qué es esta carpeta?**
> Esta carpeta es una guía educativa completa que explica **cada archivo y módulo** del proyecto GIMA AI Chatbot. Está diseñada para que cualquier persona — desde un estudiante que recién comienza hasta un desarrollador experimentado — pueda entender el proyecto de principio a fin.
>
> **¿Para qué sirve?**
> Para que puedas abrir cualquier archivo del proyecto y entender exactamente qué hace, por qué fue creado así, y cómo se conecta con el resto del sistema. Es tu "manual de referencia" para aprender el proyecto.
>
> **¿Por qué existe?**
> Porque un proyecto grande sin documentación es como un mapa sin leyenda — puedes verlo, pero no entenderlo. Esta documentación te ahorra horas de ingeniería inversa explicándote todo de forma directa y clara.

---

## ¿Qué es GIMA AI Chatbot?

GIMA AI Chatbot es un **asistente inteligente con inteligencia artificial** construido para el departamento de mantenimiento de la Universidad Nacional Experimental de Guayana (UNEG). Es una aplicación web que permite a los técnicos e ingenieros:

- **Conversar con una IA** especializada en mantenimiento industrial (texto, voz e imágenes)
- **Analizar piezas y equipos** mediante fotografías con visión por computadora
- **Crear documentos automáticamente** (checklists de mantenimiento, resúmenes de actividades, notas de cierre de órdenes de trabajo)
- **Ejecutar comandos de voz** para gestionar órdenes de trabajo sin tocar el teclado

La app está construida con tecnologías modernas: Next.js 16, React 19, TypeScript, y conecta con modelos de IA como GROQ (Llama 3.3) y Google Gemini.

---

## Orden de Lectura Recomendado

Si eres nuevo en el proyecto, léelos en este orden para entender progresivamente. Cada documento construye sobre el anterior:

| #   | Documento                                                   | Tema                             | ¿Qué aprenderás?                                                                                                                                                                                 |
| --- | ----------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 01  | [Archivos Raíz](./01-archivos-raiz.md)                      | Configuración del proyecto       | Qué es `package.json`, cómo funciona `next.config.ts`, para qué sirve `tsconfig.json`, y por qué existen las herramientas de desarrollo como ESLint, Prettier y Husky                            |
| 02  | [Punto de Entrada](./02-punto-de-entrada.md)                | Cómo arranca la app              | Qué es `layout.tsx` y por qué envuelve toda la app, cómo `page.tsx` carga el chat de forma optimizada, y para qué sirve `globals.css` con el sistema de temas                                    |
| 03  | [API del Chat](./03-api-chat.md)                            | El endpoint del backend          | Cómo funciona `api/chat/route.ts` paso a paso — desde que el mensaje sale del navegador hasta que llega la respuesta de la IA en streaming                                                       |
| 04  | [Server Actions](./04-server-actions.md)                    | Funciones del servidor           | Qué son las Server Actions de Next.js, por qué existen en vez de más endpoints API, y cómo cada una (`voice.ts`, `vision.ts`, `files.ts`) conecta con la IA                                      |
| 05  | [Configuración](./05-configuracion.md)                      | Ajustes centralizados            | Cómo se validan las variables de entorno, qué son los feature flags y por qué permiten rollout gradual, cómo funcionan los prompts del sistema, y por qué existen los límites de tamaño          |
| 06  | [Custom Hooks](./06-hooks.md)                               | Lógica de estado React           | Qué es un hook en React, por qué `usePersistentChat` usa compresión y debounce, cómo `useVoiceInput` maneja MediaRecorder, y para qué sirve cada hook del proyecto                               |
| 07  | [Utilidades Core](./07-lib-utilidades.md)                   | Herramientas internas            | Por qué el logger usa JSON estructurado, cómo funciona el rate limiter con ventana deslizante, para qué sirve la sanitización de prompts, y cómo el manejo de errores clasifica excepciones      |
| 08  | [Servicios de IA](./08-lib-servicios-ia.md)                 | Motor de inteligencia artificial | Qué es `BaseAIService` y por qué usa herencia, cómo `ChatService` orquesta rate limiting + validación + streaming, y para qué sirve cada servicio de negocio                                     |
| 09  | [Schemas de Validación](./09-lib-schemas.md)                | Validación de datos              | Qué es Zod y por qué es mejor que validar manualmente, cómo cada schema protege un flujo de datos diferente, y para qué sirve la validación tanto en entrada como en salida                      |
| 10  | [Componentes UI](./10-componentes-ui.md)                    | Bloques de construcción visual   | De dónde vienen los componentes (Radix + shadcn/ui), por qué son accesibles por defecto, cómo funciona el sistema de variantes (CVA), y para qué sirve cada uno de los 24 componentes            |
| 11  | [Componentes Shared](./11-componentes-shared.md)            | Componentes compartidos          | Qué es un ErrorBoundary y por qué React lo necesita, cómo ConfirmDialog previene acciones accidentales, y para qué sirve FeatureGuard en el sistema de feature flags                             |
| 12  | [Componentes AI Elements](./12-componentes-ai-elements.md)  | Renderizado de IA                | Cómo se renderizan los mensajes del chat con markdown, por qué hay componentes especializados para código, razonamiento y herramientas, y cómo funciona el canvas interactivo                    |
| 13  | [Feature: Chat](./13-feature-chat.md)                       | El chat principal                | Cómo `chat.tsx` orquesta ~10 subsistemas, por qué cada sub-componente es un archivo separado, cómo funcionan los hooks especializados del chat, y para qué sirve cada archivo de tipos           |
| 14  | [Feature: Voz](./14-feature-voice.md)                       | Sistema de voz                   | Cómo funciona la grabación de audio en el navegador, por qué hay dos modos (transcripción libre y comandos de voz), y cómo los comandos se convierten en acciones reales                         |
| 15  | [Feature: AI Tools](./15-feature-ai-tools.md)               | Dashboard de herramientas        | Por qué las 4 herramientas comparten componentes, cómo funciona el patrón de composición, y para qué sirve cada componente shared del dashboard                                                  |
| 16  | [Feature: Herramientas IA](./16-feature-herramientas-ia.md) | Las 4 herramientas               | Qué hace cada herramienta con ejemplos reales, cómo fluyen los datos desde el formulario hasta la respuesta de la IA, y por qué cada una tiene su propia estructura de archivos                  |
| 17  | [Types, Utils y Constants](./17-types-utils-constants.md)   | Tipos y utilidades               | Por qué los tipos globales están separados de las features, cómo funcionan las utilidades de base64 y media types, para qué sirven las constantes de mensajes, y cómo está organizado el testing |

---

## Convenciones en esta Documentación

A lo largo de todos los documentos verás estos íconos que marcan diferentes tipos de información:

- 📄 **"Líneas clave"**: Extractos del código real del proyecto con explicación detallada de qué hace cada línea y por qué está escrita así. Son las líneas más importantes que necesitas entender para comprender el archivo.

- 💡 **"¿Por qué?"**: Explica la razón detrás de una decisión de diseño o arquitectura. No solo qué se hizo, sino por qué se eligió esa solución y qué alternativas se descartaron.

- 🔗 **"Relación"**: Indica cómo se conecta un archivo con otros archivos del proyecto. Esto te ayuda a entender el flujo de datos y las dependencias entre módulos.

- ⚠️ **"Cuidado"**: Notas sobre errores comunes, trampas, o precauciones que debes tener en cuenta al modificar o usar un archivo. Aprende de los errores antes de cometerlos.

- 🧠 **"Concepto"**: Explica un concepto técnico fundamental que necesitas entender para seguir la documentación. Son mini-lecciones de programación integradas en el texto.

---

## Tecnologías que Debes Conocer

Antes de leer esta documentación, es útil (pero no obligatorio) tener una base en estas tecnologías. Si no las conoces, no te preocupes: cada documento explica los conceptos a medida que aparecen.

| Tecnología         | ¿Qué es?                                                                           | ¿Para qué la usa GIMA?                                                        |
| ------------------ | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **TypeScript**     | JavaScript con tipos estáticos que previenen errores                               | Todo el código del proyecto está en TypeScript para máxima seguridad          |
| **React 19**       | Biblioteca para construir interfaces de usuario con componentes reutilizables      | Todas las pantallas del chat y herramientas están construidas con React       |
| **Next.js 16**     | Framework fullstack que añade servidor, rutas, y optimizaciones sobre React        | Permite tener API routes, Server Actions, y SSR en un solo proyecto           |
| **Tailwind CSS 4** | Framework CSS basado en clases de utilidad (en vez de escribir CSS puro)           | Todos los estilos visuales de la app usan clases de Tailwind                  |
| **Zod**            | Biblioteca de validación que verifica la forma de los datos en tiempo de ejecución | Se usa para validar todo: requests, respuestas de la IA, variables de entorno |
| **Vercel AI SDK**  | Kit de desarrollo para integrar modelos de IA con streaming                        | Conecta la app con GROQ y Google Gemini para el chat y las herramientas       |

---

## ¿Cómo Leer esta Documentación?

1. **Si quieres entender el proyecto completo**: Lee los documentos en orden del 01 al 17. Cada uno construye sobre conceptos explicados en los anteriores.

2. **Si quieres entender un archivo específico**: Busca en la tabla de arriba qué documento lo cubre y ve directo a ese documento.

3. **Si quieres contribuir código**: Lee primero el 01 (para entender el setup), luego el documento del módulo que vas a modificar.

4. **Si quieres aprender programación web moderna**: Esta documentación funciona como un tutorial práctico. Los conceptos están explicados en contexto, con código real del proyecto.
