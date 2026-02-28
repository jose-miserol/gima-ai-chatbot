# Data Flow Diagrams (DFDs) - GIMA AI Chatbot

A continuación, se presentan los Diagramas de Flujo de Datos (DFD) **Lógicos** para el sistema **GIMA AI Chatbot**. Siguiendo la metodología de análisis estructurado puro (Kendall & Kendall / general), este documento se centra en el **QUÉ** hace el sistema (flujos de información y procesos de negocio) en lugar de en el **CÓMO** (tecnologías, manejo de JSON, detalles de framework, interceptores o mapeo estricto de tipos).

---

## DFD Nivel 0 (Nivel de Contexto)

El nivel de contexto ilustra el sistema GIMA AI Chatbot en su totalidad y su interacción con las entidades externas.

### Tabla de Elementos (Nivel 0)

| ID  | Tipo            | Nombre                      | Descripción                                                                 |
| --- | --------------- | --------------------------- | --------------------------------------------------------------------------- |
| E1  | Entidad Externa | **TÉCNICO**                 | Usuario en campo o taller que requiere asistencia interactiva.              |
| E2  | Entidad Externa | **SISTEMA BACKEND GIMA**    | Sistema central para control de inventario y Órdenes de Trabajo (OT).       |
| E3  | Entidad Externa | **PROVEEDOR DE IA**         | Servicios cognitivos externos (Generación de texto, Visión, Transcripción). |
| P0  | Proceso         | **SISTEMA GIMA AI CHATBOT** | La plataforma inteligente de mediación, proceso y control conversacional.   |

### Diagrama Mermaid (Nivel 0)

```mermaid
flowchart LR
    E1[["E1: TÉCNICO"]]
    E2[["E2: SISTEMA BACKEND GIMA"]]
    E3[["E3: PROVEEDOR DE IA"]]

    P0("0 SISTEMA GIMA AI CHATBOT")

    E1 -->|"Instrucción o Consulta"| P0
    E1 -->|"Archivo Multimedia"| P0

    P0 -->|"Respuesta Generada"| E1
    P0 -->|"Opciones Visuales"| E1

    P0 -->|"Solicitud de Transacción o Consulta"| E2
    E2 -->|"Datos de Inventario y OT"| P0

    P0 -->|"Prompt y Contexto"| E3
    P0 -->|"Archivo para Análisis"| E3
    E3 -->|"Contenido Generado"| P0
    E3 -->|"Análisis Multimedia"| P0
```

---

## DFD Nivel 1 (Subsistemas Principales)

Se desglosa el proceso principal P0 en los cuatro grandes módulos lógicos del chatbot.

### Tabla de Elementos (Nivel 1)

| ID  | Tipo    | Nombre                               | Descripción                                                                              |
| --- | ------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| P1  | Proceso | **GESTIONAR INTERACCIÓN DE USUARIO** | Recepción de inputs, administración de la vista y visualización de progreso.             |
| P2  | Proceso | **PROCESAR CONTENIDO MULTIMEDIA**    | Transformación de voz y documentos en texto o datos útiles para el contexto.             |
| P3  | Proceso | **GENERAR RESPUESTA INTELIGENTE**    | Core lógico; evalúa el contexto y pide a la IA la respuesta o deducción de herramientas. |
| P4  | Proceso | **EJECUTAR HERRAMIENTAS DE NEGOCIO** | Aplicación directa de las reglas de operación sobre el sistema central.                  |
| D1  | Almacén | **D1 HISTORIAL DE CONVERSACIÓN**     | Memoria temporal del hilo de discusión y tareas en progreso.                             |

### Diagrama Mermaid (Nivel 1)

```mermaid
flowchart TD
    E1[["E1: TÉCNICO"]]
    E2[["E2: SISTEMA BACKEND GIMA"]]
    E3[["E3: PROVEEDOR DE IA"]]

    P1("1 GESTIONAR INTERACCIÓN DE USUARIO")
    P2("2 PROCESAR CONTENIDO MULTIMEDIA")
    P3("3 GENERAR RESPUESTA INTELIGENTE")
    P4("4 EJECUTAR HERRAMIENTAS DE NEGOCIO")

    D1[("D1 HISTORIAL DE CONVERSACIÓN")]

    %% Entradas de usuario
    E1 -->|"Instrucción o Consulta"| P1
    E1 -->|"Archivo Multimedia"| P2

    %% Salidas a usuario
    P1 -->|"Respuesta Generada"| E1
    P1 -->|"Opciones Visuales"| E1

    %% Historial
    P1 -->|"Nuevo Mensaje"| D1
    D1 -->|"Contexto de Sesión"| P1
    D1 -->|"Historial Relevante"| P3

    %% Interacción entre subsistemas y multimedia
    P2 -->|"Transcripción o Extracción"| P1
    P2 -->|"Archivo para Análisis"| E3
    E3 -->|"Análisis Multimedia"| P2

    %% Lógica de respuesta
    P1 -->|"Intención del Usuario"| P3
    P3 -->|"Prompt y Contexto"| E3
    E3 -->|"Contenido Generado"| P3

    P3 -->|"Respuesta Formateada"| P1

    %% Operaciones de negocio
    P3 -->|"Solicitud de Operación"| P4
    P4 -->|"Solicitud de Transacción o Consulta"| E2
    E2 -->|"Datos de Inventario y OT"| P4
    P4 -->|"Resultado de Operación"| P3
```

---

## DFD Nivel 2 (Desglose del Proceso 4.0: Ejecutar Herramientas de Negocio)

Se ilustra cómo, de manera lógica, el sistema valida y lleva a cabo la instrucción sugerida por la IA sin adentrarse en detalles de implementación.

### Tabla de Elementos (Nivel 2)

| ID   | Tipo    | Nombre                              | Descripción                                                                                       |
| ---- | ------- | ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| P4.1 | Proceso | **CLASIFICAR ACCIÓN Y AUTORIZAR**   | Decisión primaria: comprueba qué regla de negocio aplica y si es permitida.                       |
| P4.2 | Proceso | **VALIDAR REGLAS DE NEGOCIO**       | Inspecciona lógicamente que los argumentos pasados a la herramienta sean correctos y congruentes. |
| P4.3 | Proceso | **GENERAR DOCUMENTOS DE ACTIVIDAD** | Si procede, agrupa el trabajo en formatos preestablecidos (resúmenes, checklists).                |
| P4.4 | Proceso | **PROCESAR TRANSACCIÓN CENTRAL**    | Ejecuta la consulta o modificación final en el repositorio principal del negocio.                 |

### Diagrama Mermaid (Nivel 2)

```mermaid
flowchart TD
    %% Flujos de interfaz desde P3 y hacia E2
    FI_IN(("Flujo Entrada: Solicitud de Operación"))
    FI_OUT(("Flujo Salida: Resultado de Operación"))
    E2_EXT[["E2: SISTEMA BACKEND GIMA"]]

    P41("4.1 CLASIFICAR ACCIÓN Y AUTORIZAR")
    P42("4.2 VALIDAR REGLAS DE NEGOCIO")
    P43("4.3 GENERAR DOCUMENTOS DE ACTIVIDAD")
    P44("4.4 PROCESAR TRANSACCIÓN CENTRAL")

    %% Conexiones
    FI_IN -->|"Detalle de Herramienta"| P41

    P41 -->|"Operación Denegada"| FI_OUT
    P41 -->|"Parámetros de Operación"| P42

    P41 -->|"Datos Crudos de Actividad"| P43
    P43 -->|"Documento Estandarizado"| P44

    P42 -->|"Error Lógico"| FI_OUT
    P42 -->|"Instrucción Verificada"| P44

    P44 -->|"Solicitud de Transacción o Consulta"| E2_EXT
    E2_EXT -->|"Datos de Inventario y OT"| P44

    P44 -->|"Confirmación de Operación"| FI_OUT
```

> **Aclaración sobre Niveles Físicos Adicionales:**
> En la versión anterior de este diagrama se incluían los "Niveles 3 y 4" que abordaban temas como **Mapeo de DTOs, Fetch Interceptors, Tokens de Autenticación, Paginación JSON y Transformación de Fechas UTC**.
>
> De acuerdo con las mejores prácticas del diseño estructurado (DFD Lógico), todos esos elementos son **detalles de implementación física** que describen _cómo_ se programa y no _qué_ flujo de información requiere el negocio. Por lo tanto, fueron eliminados intencionalmente de este documento enfocado en el análisis lógico puro.
