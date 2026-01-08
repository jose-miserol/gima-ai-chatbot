# RULES

**Versión:** 0.1 (Temario Pragmático)  
**Estado:** Propuesta de Índice Normativo - **Revisado con feedback de implementación**  
**Mejoras Clave:** Budgets realistas, flexibilidad técnica, onboarding práctico, claridad Next.js 15

---

## 1. FILOSOFÍA Y PRINCIPIOS DE INGENIERÍA (Pragmatismo Enterprise)
### 1.1. Principios Rectores y Cultura
- Mentalidad "Zero Flaws": **Resiliencia sobre velocidad, pragmatismo sobre dogmatismo**
- Regla de Oro: "Documentar lo que funciona, **permitir excepciones justificadas vía ADR**"
- Filosofía FIRST: Hacer obvio lo correcto **a través de herramientas, no solo documentación**

### 1.2. Reglas No Negociables (Binarias ✅/❌)
- Límites de Complejidad: Archivos (300L), Features (250L), Hooks (100L) **- Aplicados post-MVP**
- Complejidad Ciclomática: <12 (Features), <8 (Hooks) **- Medida en CI, no bloqueante local**
- TypeScript Strict: `any` prohibido **en producción**, permitido en prototipos con `// @ts-expect-error`
- Separación de Conceptos: UI ↔ Business Logic ↔ Service Layer **- Verificado por boundaries**

### 1.3. Objetivos de Sistema (SLA/SLO Realistas)
- Escalabilidad: Diseñado para **crecimiento progresivo a 10M+ usuarios**
- Disponibilidad: **99.9% uptime** (JWT Fallback + Redis replication) **con SLOs medibles**
- Resiliencia: **Minimizar** race conditions y duplicate messages **con patrones probados**

---

## 2. ARQUITECTURA DE CAPAS Y BOUNDARIES (Enforzado por ESLint)
### 2.1. Estructura de Directorios v0.4 (Obligatoria, con CLI)
- Layout jerárquico: `app/` → `components/` → `domain/` → `infrastructure/` → `lib/` → `types/`
- **Nueva Regla**: Estructura generada por `create-feature.sh` **antes de escribir código**
- Server Isolation: `src/server` prohibido importar React/Hooks/Stores **- Error de ESLint**

### 2.2. Reglas de Dependencia entre Capas (Boundaries con ADR para excepciones)
- **Jerarquía Estricta**: Lib/Core → UI → Features → App (flujo unidireccional) **pero...**
- **Cláusula de Flexibilidad**: Features pueden comunicarse **vía Event Bus** documentado
- **Excepciones Arquitectónicas**: Requieren **ADR aprobado** con justificación de trade-offs

### 2.3. Mapeo ESLint-plugin-boundaries
- Configuración en `eslint.config.mjs` **con reglas progresivas (warning → error)**
- **Nueva**: Reglas específicas por entorno (local: warnings, CI: errors)
- Validación automática en pipeline CI/CD **con reporte de deuda técnica**

---

## 3. CONVENCIONES DE CÓDIGO Y ANÁLISIS ESTÁTICO
### 3.1. TypeScript Enterprise Strict (Pragmático)
- Config: `tseslint.configs.strictTypeChecked` **+ overrides para desarrollo**
- Prohibiciones **graduales**: Mes 1: warnings, Mes 2: errors para `any` y `non-null-assertion`
- **Nueva Regla**: Floating promises son **error inmediato** (riesgo de bugs silenciosos)

### 3.2. Sistema de Nomenclatura y Estructura (Auto-aplicado)
- **Archivos/Carpetas**: kebab-case **aplicado por Prettier plugin**
- **Componentes/Clases**: PascalCase **con validación en PR review**
- **Features**: Estructura plana **generada automáticamente por CLI**

### 3.3. Gestión de Imports y Dependencias
- Prohibido: imports relativos profundos (`../../../`) **- Transformado automáticamente por ESLint fix**
- Obligatorio: alias `@/` **configurado en tsconfig y VSCode settings compartidas**
- **Nuevo**: Plugin de importación automática en IDE para reducir fricción

---

## 4. ARQUITECTURA SaaS Y MULTI-TENANCY
### 4.1. Contexto Obligatorio y Aislamiento (Con templates)
- Todo componente de negocio debe recibir `tenantId` **- Template de componente lo incluye por defecto**
- APIs internas: validación estricta de contexto de tenant **con middleware generable**
- APIs proxy: pueden operar sin contexto **pero requieren metricas de uso por IP**

### 4.2. Gestión de Estado (Frontend - Next.js 15 aligned)
- `useSyncExternalStore` para estado dependiente del navegador **- Ejemplo en template**
- **Nueva Sección**: Server Actions **como wrapper, no como reemplazo** de Service Layer
- Patrón: Server Actions llaman a Services, **nunca contienen lógica de negocio directa**

### 4.3. Modelo de Datos Multi-Tenant
- Filtrado automático por `tenantId` **inyectado en Prisma client extension**
- Validación de planes: `free`, `pro`, `enterprise` **con Feature Flags dinámicos**
- Aislamiento de datos **verificado en tests de integración**

---

## 5. PATRONES DE RESILIENCIA Y CONCURRENCIA (Backend Core)
### 5.1. Distributed Locks con Redis (Obligatorio para operaciones críticas)
- Uso: `RedisLock.acquire(key, ttl, retries)` **con wrapper simplificado para casos comunes**
- Aplicación obligatoria: **Solo donde hay riesgo demostrado** de race condition
- **Nuevo**: Lista mantenida de operaciones que requieren lock **basada en incidentes reales**

### 5.2. Idempotencia y Manejo de Estados (Pragmático)
- Obligatorio en endpoints **con side effects financieros o de estado irreversible**
- Header: `Idempotency-Key` **generado automáticamente por client SDK**
- Estados: `pending` → `completed` | `failed` **con dashboard de monitoring**

### 5.3. Circuit Breakers Multi-Tier (Configurables)
- Implementación tiered: **Basada en impacto de negocio, no solo en tipo técnico**
- Timeouts configurables **por operación en runtime (no solo build time)**
- **Nuevo**: Circuit Breakers **monitoreados con Grafana, no solo logs**

### 5.4. Rate Limiting Adaptativo (Basado en comportamiento)
- Token bucket **con ajuste automático basado en uso histórico**
- Claves compuestas: **Aprendidas de patrones de ataque reales**
- Cost-based limiting **calibrado mensualmente según costos reales de LLM**

---

## 6. STREAMING Y TIEMPO REAL (SSE como Default, WebSockets con ADR)
### 6.1. Arquitectura de Comunicación (Pragmática)
- **SSE como default** para streaming unidireccional (LLM → Cliente)
- **WebSockets permitidos** bajo ADR aprobado para casos bidireccionales de alta frecuencia
- **Criterios para WebSockets**: >100 msg/sec, latencia <100ms, estado de conexión crítico

### 6.2. Implementación de Flujo Completo (Con abstracción común)
- `POST /api/chat/stream` (con idempotency) **- Template disponible**
- `GET /api/chat/subscribe` (SSE subscription) **- Código boilerplate generable**
- **Nuevo**: Abstract Transport Layer **que permite cambiar SSE ↔ WebSockets**

### 6.3. Cliente React (Hook Optimizado con fallback)
- `useSSEChat` con optimistic updates **y auto-reconnect con backoff exponencial**
- Conexión automática **con indicadores UX de estado de conexión**
- Graceful degradation **a polling si SSE falla consistentemente**

---

## 7. SEGURIDAD Y AUTENTICACIÓN ENTERPRISE
### 7.1. Stack de Autenticación (Único pero actualizable)
- NextAuth v5 + Prisma Adapter **con plan de migración a Auth.js cuando estable**
- Session strategy: `'database'` **con migración gradual a JWT stateless si escala lo requiere**
- **Prohibido**: Adapters custom **sin benchmark de performance que justifique la complejidad**

### 7.2. Mecanismos de Fallback (Probados regularmente)
- JWT Fallback **probado en chaos testing mensual**
- Session cache L1 en Redis **con invalidación eficiente en updates**
- Circuit breaker para auth DB **con métricas de latencia en dashboard**

### 7.3. Gestión de Secretos (Zero Trust pero práctico)
- **Producción**: Infisical para rotación automática
- **Desarrollo**: `.env.local` con valores dummy **validados por Zod schema**
- Validación Zod **que diferencia entre entornos (estricto en prod, permisivo en dev)**

---

## 8. DESARROLLO DE COMPONENTES Y UI (React/Next.js 15)
### 8.1. Arquitectura de Componentes (Generada por CLI)
- Feature-Based: `src/components/features/<feature>/` **generado por `create-feature.sh`**
- Estructura mínima: **Pre-populada con ejemplos reales, no placeholders**
- Límites: **Aplicados post-code review, no durante prototyping**

### 8.2. Patrones de Estado y Efectos (Modernos)
- Gestión de estado: `useSyncExternalStore` **solo cuando necesario, no por default**
- Error Boundaries **con recovery actions, no solo logging**
- Class Variance Authority (CVA) **pero aceptando css-in-js para componentes complejos**

### 8.3. Estándares de Calidad UI (Realistas)
- Accesibilidad: WCAG 2.1 AA **priorizado (nivel A primero, luego AA)**
- Internacionalización: `next-intl` **con extractor automático de textos**
- **Performance budgets REALISTAS**:
  - JS execution time: <5ms por mensaje complejo
  - First render: <50ms para componente feature completo
  - **Nuevo**: Budgets diferenciados por tipo de dispositivo (desktop vs móvil)

---

## 9. SERVICE LAYER Y SERVER ACTIONS (Next.js 15 Aligned)
### 9.1. Patrón BaseService (Integrado con Server Actions)
- **Nuevo Modelo**: Server Actions como **entrypoint HTTP-less**, Services como **lógica reutilizable**
- Server Actions **delegando a Services**, nunca conteniendo lógica de negocio
- Ejemplo en template: `app/actions/chat.ts` → `services/ChatService.ts`

### 9.2. Implementación de Servicios (Stateless cuando posible)
- **Stateless por default**: Services como funciones puras cuando posible
- **Stateful cuando necesario**: Singleton solo para conexiones pesadas (DB pools)
- Logging estructurado **con correlation ID propagado automáticamente**

### 9.3. Contratos y Comunicación (Type-safe end-to-end)
- APIs internas: **tZod para validación runtime con inferencia TypeScript**
- Server Actions: **"use server" con tipos compartidos cliente/servidor**
- **Nuevo**: Generador de tipos a partir de Zod schemas para frontend

---

## 10. OBSERVABILIDAD, LOGGING Y MONITORING
### 10.1. Logging Estructurado (Contexto automático)
- **Prohibido**: `console.log` **pero con auto-transformer a structured logger en CI**
- **Obligatorio**: `lib/observability/logger.ts` **con API idéntica a console para adopción**
- Contexto automático: **Middleware de Next.js que inyecta request context**

### 10.2. Métricas Realistas (Basadas en percentiles)
- OpenTelemetry: **p95 y p99, no solo promedios**
- SLO tracking: **ventanas móviles de 28 días, no instantáneas**
- Dashboard por operación: **con comparativa histórico para detectar degradaciones**

### 10.3. Health Checks (Accionables)
- Endpoint `/health`: **con degradación gradual (healthy → degraded → down)**
- Graceful shutdown: **con draining de conexiones activas verificable**
- **Nuevo**: Self-healing triggers **basados en health check patterns**

---

## 11. TESTING Y CONTROL DE CALIDAD (Pragmático)
### 11.1. Filosofía de Testing (Business Impact First)
- **FIRST aplicado pragmáticamente**: Fast **pero no a costo de fiabilidad**
- **Nuevo Principio**: Testar **impacto de negocio, no solo cobertura de código**
- Tests de contrato **para APIs externas, mocks para internas**

### 11.2. Tipos de Tests (Priorizados)
- **Crítico**: Tests de regresión para bugs pasados
- **Alto**: Tests de flujos de pago y autenticación
- **Medio**: Tests de componentes de UI
- **Bajo**: Tests de utils genéricas

### 11.3. Reglas Pragmáticas para Tests
- Permitido: `any` **solo en tests de integración con APIs externas no tipadas**
- **Nueva Regla**: Tests pueden violar boundaries **si prueban integración entre capas**
- Overrides ESLint: **configuración separada para `__tests__/`**

---

## 12. DOCUMENTACIÓN Y ESTÁNDARES (Vivos, no burocráticos)
### 12.1. JSDoc (Cuando agrega valor)
- **Requerido cuando**: API pública, lógica compleja, decisiones no obvias
- **No requerido cuando**: Getters/setters triviales, componentes con props auto-documentadas
- Formato: **Enfocado en "por qué", no solo "qué"**

### 12.2. Gestión de Deuda Técnica (Accionable)
- Todo `TODO` debe tener **estimación de impacto y esfuerzo**
- Refactorización obligatoria **asignada a sprints, no solo documentada**
- ADR: **Plantilla con sección de reversión y alternativas consideradas**

### 12.3. Onboarding y Conocimiento
- **Nuevo**: "Golden Path" guide - **cómo hacer features comunes correctamente**
- Documentación **centrada en ejemplos ejecutables, no solo teoría**
- **CLI que sugiere documentación** al detectar patrones

---

## 13. CONFIGURACIÓN Y ENTORNOS (Desarrollo-first)
### 13.1. Variables de Entorno (Validación progresiva)
- Validación Zod **con mensajes de error amigables para desarrolladores**
- Separación clara: **configuración de desarrollo con valores por defecto útiles**
- **Nuevo**: `config.validate({ strict: false })` para desarrollo rápido

### 13.2. Sistema de Feature Flags (Developer Experience)
- Por entorno: **override local permitido para testing**
- Por plan SaaS: **simulador de planes en desarrollo**
- Componente `FeatureGuard` **con modo desarrollo que muestra todos los features**

### 13.3. Desarrollo Local (Zero-config cuando posible)
- Docker Compose **con datos de muestra realistas**
- Scripts de seeding **que crean escenarios de testing comunes**
- **Nuevo**: Local development con **hot reload de configuración**

---

## 14. WORKFLOW Y PRs (Automatizado, no burocrático)
### 14.1. Checklist de Pre-Commit (Ayuda, no obstáculo)
- Validación ESLint **con auto-fix cuando posible**
- **Nuevo**: `commit --fix` que **aplica automáticamente fixes no controversiales**
- Verificación de tests **solo para archivos modificados (incremental)**

### 14.2. Criterios de Aceptación de PR (Contextuales)
1. ❌ ESLint errors **en código modificado** (legacy puede tener warnings)
2. ❌ Violaciones de boundaries **sin ADR aprobado**
3. ❌ **Degradación medible** de performance en benchmarks establecidos
4. ❌ **Reducción** de cobertura en código crítico modificado
5. ❌ Breaking changes **sin migración path documentada**

### 14.3. Code Review (Enfocado en lo importante)
- **Prioridad 1**: Correctitud y seguridad
- **Prioridad 2**: Mantenibilidad a largo plazo
- **Prioridad 3**: Estilo y convenciones (menos crítica)

---

## 15. PERFORMANCE Y OPTIMIZACIÓN (Realista)
### 15.1. Budgets Basados en Datos Reales
- **Basado en percentiles de usuarios reales**, no en condiciones ideales de laboratorio
- **Diferenciado por**:
  - Tipo de dispositivo (móvil/desktop)
  - Condiciones de red (3G/4G/WiFi)
  - Complejidad del contenido (texto simple/markdown complejo)

### 15.2. Métricas Accionables
- LCP, FID, CLS **pero también métricas de negocio (time to interactive para features clave)**
- **Nuevo**: User-centric metrics **no solo técnicos**
- Alerts: **solo cuando afectan percentiles significativos de usuarios**

### 15.3. Optimización Pragmática
- Lazy loading: **basado en analytics de uso real**
- Memoización: **solo cuando profiling demuestra necesidad**
- **Regla**: No optimizar prematuramente **pero monitorear proactivamente**

---

## 16. DESPLIEGUE Y OPERACIONES
### 16.1. Infraestructura (Como código con rollback fácil)
- Terraform: **con planes de rollback documentados**
- Monitoring: **con dashboards específicos para SLOs de negocio**
- Secrets management: **con auditoría automática de acceso**

### 16.2. CI/CD Pipeline (Seguro pero rápido)
- Workflows: **paralelos cuando posible**
- Canary deployment: **con métricas de negocio, no solo técnicas**
- Rollback automático: **cuando health check falla o métricas de negocio se degradan**

### 16.3. SRE y On-call (Humano-centric) 
- Runbooks: **con pasos accionables, no solo teoría**
- Escalación: **basada en impacto de negocio, no solo en alertas técnicas**
- **Nuevo**: Post-mortems **con foco en mejorar procesos, no en culpar personas**

---

## 17. EVOLUCIÓN Y MEJORA CONTINUA
### 17.1. Proceso de Cambio (Iterativo)
- **Nuevo**: "Rules Amendment Process" **para cambios menores sin ADR completo**
- Versión semántica: **con changelog enfocado en impacto para desarrolladores**
- **Feedback loop mensual** sobre dolor points en cumplimiento de reglas

### 17.2. Adopción Gradual
- **Nuevo**: Fases de adopción por equipo/feature flag
- Métricas de adopción: **% de código generado por CLI, no solo % de reglas cumplidas**
- **Incentivos** para adopción temprana, no penalizaciones por incumplimiento

### 17.3. Medición de Impacto
- **Correlación** entre cumplimiento de reglas y reducción de bugs/incidentes
- **Ajuste continuo** de reglas basado en data, no en opiniones
- **Simplificación** cuando reglas demuestran poco valor