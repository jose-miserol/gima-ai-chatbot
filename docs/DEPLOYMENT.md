# Guía de Despliegue - GIMA AI Chatbot

Esta guía cubre el proceso completo de despliegue del chatbot en producción.

## 🚀 Plataformas Recomendadas

### 1. Vercel (Recomendado)

**Ventajas:**

- ✅ Integración nativa con Next.js
- ✅ Deploy automático desde Git
- ✅ Edge Functions globales
- ✅ Gratis para proyectos personales
- ✅ SSL/HTTPS automático

**Desventajas:**

- ❌ Límites en plan gratuito

### 2. Netlify

**Ventajas:**

- ✅ Fácil configuración
- ✅ CI/CD integrado
- ✅ Gratis para proyectos pequeños

**Desventajas:**

- ❌ Soporte Next.js menos optimizado que Vercel

### 3. Railway / Render

**Ventajas:**

- ✅ Soporte Docker
- ✅ Bases de datos integradas

**Desventajas:**

- ❌ Configuración más compleja

---

## 📦 Despliegue en Vercel (Paso a Paso)

### Prerrequisitos

- [ ] Cuenta en [Vercel](https://vercel.com)
- [ ] Repositorio Git (GitHub, GitLab, o Bitbucket)
- [ ] API Keys de GROQ y Google Gemini

### Paso 1: Preparar el Repositorio

```bash
# Asegúrate de que todo esté comiteado
git status

# Crea un repositorio en GitHub (si no existe)
gh repo create gima-ai-chatbot --public --source=. --remote=origin

# Push del código
git push -u origin main
```

### Paso 2: Conectar con Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository** → Selecciona tu repo
3. **Configure Project:**
   - Framework Preset: **Next.js**
   - Root Directory: `./` (raíz)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

### Paso 3: Configurar Variables de Entorno

En la página de configuración del proyecto:

**Environment Variables:**

| Key                            | Value                 | Entorno                          |
| ------------------------------ | --------------------- | -------------------------------- |
| `GROQ_API_KEY`                 | `gsk_xxxxxxxxxxxxx`   | Production, Preview, Development |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `AIzaSyxxxxxxxxxxxxx` | Production, Preview, Development |
| `NODE_ENV`                     | `production`          | Production                       |

> **Importante:** Marca las 3 casillas (Production, Preview, Development) para cada variable.

**Cómo obtener las API Keys:**

1. **GROQ API Key:**
   - Visita [console.groq.com](https://console.groq.com)
   - Crea una cuenta gratuita
   - Ve a **API Keys** → **Create API Key**
   - Copia la key (empieza con `gsk_`)

2. **Google Gemini API Key:**
   - Visita [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Crea una key (empieza con `AIzaSy`)

### Paso 4: Deploy

1. Click en **Deploy**
2. Espera 1-2 minutos
3. ✅ Tu app estará en `https://[tu-proyecto].vercel.app`

### Paso 5: Verificación

Prueba estos endpoints:

```bash
# Health check
curl https://tu-proyecto.vercel.app

# API Chat
curl -X POST https://tu-proyecto.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hola"}]}'
```

---

## 🔄 Deploy Automático (CI/CD)

Una vez conectado con Vercel, cada `git push` a `main` despliega automáticamente:

```bash
git add .
git commit -m "feat: nueva funcionalidad"
git push origin main
# 🚀 Vercel detecta el push y hace deploy automático
```

### Deploy de Preview (Ramas)

```bash
# Crea una rama
git checkout -b feature/nueva-caracteristica

# Haz cambios y commitea
git commit -m "feat: nueva característica"

# Push de la rama
git push origin feature/nueva-caracteristica

# 🔍 Vercel crea un deploy de preview en una URL única
```

---

## ⚙️ Configuración Avanzada

### Custom Domain

1. Ve a **Settings → Domains** en Vercel
2. Agrega tu dominio (ej: `chatbot.tuempresa.com`)
3. Configura DNS:
   ```
   Type: CNAME
   Name: chatbot
   Value: cname.vercel-dns.com
   ```

### Build Configuration

Archivo `vercel.json` (opcional):

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"],
  "env": {
    "NODE_ENV": "production"
  }
}
```

### Redirects y Rewrites

En `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ];
  },
};
```

---

## 🐳 Despliegue con Docker (Alternativo)

### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

### .dockerignore

```
node_modules
.next
.git
.env.local
```

### Build y Run

```bash
# Build
docker build -t gima-chatbot .

# Run
docker run -p 3000:3000 \
  -e GROQ_API_KEY=gsk_xxx \
  -e GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy_xxx \
  gima-chatbot
```

---

## 📊 Monitoreo y Logs

### Vercel Analytics

1. Ve a **Analytics** en el dashboard de Vercel
2. Monitorea:
   - Page views
   - Request counts
   - Error rates
   - Web Vitals (Core Web Vitals)

### Error Tracking con Sentry (Opcional)

```bash
npx @sentry/wizard@latest -i nextjs
```

Configura en `sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

### Logs en Vercel

```bash
# Ver logs en tiempo real
vercel logs [deployment-url] --follow

# Logs de producción
vercel logs --prod
```

---

## 🛡️ Seguridad en Producción

### Variables de Entorno

- ✅ **Nunca** commitees `.env.local`
- ✅ Usa `.env.example` como plantilla
- ✅ Rota API keys periódicamente

### Headers de Seguridad

Ya configurados en [`next.config.ts`](file:///c:/Users/joses/OneDrive/Escritorio/gima-ai-chatbot/next.config.ts):

```typescript
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    },
  ];
}
```

### Rate Limiting (Futuro)

Pendiente de implementación con Upstash Redis.

---

## 🔧 Troubleshooting

### Error: "Missing environment variables"

**Causa:** Variables de entorno no configuradas en Vercel.

**Solución:**

1. Ve a **Settings → Environment Variables**
2. Agrega `GROQ_API_KEY` y `GOOGLE_GENERATIVE_AI_API_KEY`
3. Redeploy: **Deployments → [último deploy] → Redeploy**

### Error: Build failed

**Causa:** Error de TypeScript o falta de dependencias.

**Solución:**

```bash
# Localmente
npm run type-check
npm run lint
npm run build

# Si pasa localmente, verifica variables de entorno en Vercel
```

### Error: API requests failing in production

**Causa:** CORS, API keys inválidas, o límites de Vercel.

**Solución:**

1. Verifica que las API keys sean válidas
2. Revisa los logs en Vercel
3. Confirma que las rutas API empiecen con `/api/`

### Performance lento

**Optimizaciones:**

- [ ] Usa Edge Functions (cambiar región en Vercel)
- [ ] Implementa caché de respuestas
- [ ] Reduce tamaño del bundle

---

## 📈 Escalabilidad

### Plan Gratuito de Vercel

**Límites:**

- 100 GB de bandwidth/mes
- 6,000 minutos de Edge Functions/mes
- 1,000 Image Optimizations/mes

**Si excedes:**

- Upgrade a **Pro** ($20/mes)
- O considera rate limiting

### Optimización de Costos

1. **Usar caché agresivamente:**

   ```typescript
   export const revalidate = 3600; // 1 hora
   ```

2. **Implementar rate limiting:**
   - Usa Upstash Redis (plan gratuito: 10,000 requests/día)

3. **Optimizar imágenes:**
   - Next.js Image Optimization automático

---

## 🚦 Checklist de Deploy

Antes de producción:

- [ ] Todas las variables de entorno configuradas
- [ ] `npm run build` pasa sin errores
- [ ] `npm run type-check` pasa sin errores
- [ ] `npm run lint` pasa sin warnings críticos
- [ ] Tests ejecutados (si aplica)
- [ ] README.md actualizado con URL de producción
- [ ] Analytics configurado
- [ ] Dominio personalizado configurado (opcional)
- [ ] Logs y monitoreo activos

---

## 📚 Enlaces Útiles

- [Vercel Docs](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel CLI](https://vercel.com/docs/cli)
- [Environment Variables Guide](https://vercel.com/docs/environment-variables)
