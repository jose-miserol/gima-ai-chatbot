/**
 * @file auth.ts
 * @module app/actions/auth
 *
 * ============================================================
 * SERVER ACTION — AUTENTICACIÓN CON BACKEND LARAVEL (SANCTUM)
 * ============================================================
 *
 * QUÉ HACE ESTE MÓDULO:
 *   Expone dos Server Actions para el manejo de autenticación entre
 *   el frontend Next.js y el backend Laravel de GIMA:
 *   1. `loginSilent`   → Realiza un login automático con credenciales
 *                        de prueba y guarda el token en una cookie HTTP-only.
 *   2. `getAuthToken`  → Lee el token de autenticación desde las cookies
 *                        del servidor para usarlo en llamadas al backend.
 *
 * CONTEXTO EN GIMA:
 *   El backend es una API Laravel que usa Laravel Sanctum para autenticación
 *   basada en tokens. El frontend Next.js necesita enviar este token en el
 *   header `Authorization: Bearer <token>` en cada llamada a la API REST.
 *
 *   `loginSilent` es un mecanismo de login automático para desarrollo/pruebas
 *   que evita que el desarrollador tenga que autenticarse manualmente cada vez
 *   que reinicia el servidor de desarrollo.
 *
 * ARQUITECTURA DE SEGURIDAD:
 *   - El token se almacena en una cookie HTTP-only (no accesible desde JS del cliente).
 *   - En producción, la cookie es `secure: true` (solo HTTPS).
 *   - `sameSite: 'lax'` previene ataques CSRF en la mayoría de escenarios.
 *   - Las credenciales de prueba SOLO deben usarse en desarrollo.
 *
 * DÓNDE SE CONSUME:
 *   - Middleware de autenticación de Next.js (app/middleware.ts)
 *   - Hooks de inicialización de sesión
 *   - Cualquier Server Action que necesite llamar al backend autenticado
 * ============================================================
 */

'use server';

import { cookies } from 'next/headers';
import { env } from '@/app/config/env';

// ============================================================
// Desactivar validación SSL en desarrollo
// ============================================================
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

// ============================================================
// CONSTANTE: Nombre de la cookie del token de autenticación
// ============================================================
const AUTH_COOKIE_NAME = 'auth_token';

// ============================================================
// ACTION 1: loginSilent
// ============================================================

/**
 * Realiza un login automático con credenciales de prueba en el backend Laravel.
 *
 * QUÉ HACE:
 *   Envía una petición POST al endpoint de autenticación de Laravel Sanctum
 *   con credenciales hardcodeadas. Si el login es exitoso, guarda el token
 *   JWT/Sanctum en una cookie HTTP-only y lo retorna.
 *
 * CÓMO FUNCIONA (paso a paso):
 *   1. Construye la URL del endpoint de login desde la variable de entorno
 *      NEXT_PUBLIC_BACKEND_API_URL (ej. https://localhost:8000).
 *   2. Hace POST con las credenciales en JSON.
 *   3. Verifica que la respuesta HTTP sea 2xx.
 *   4. Parsea el JSON y extrae el token de `data.data.token`.
 *   5. Guarda el token en una cookie HTTP-only con expiración de 1 semana.
 *   6. Retorna el token (string) o null si hubo algún error.
 *
 * POR QUÉ CREDENCIALES HARDCODEADAS:
 *   Esta función es exclusivamente para desarrollo y pruebas.
 *   Permite que el equipo de frontend trabaje sin depender de un flujo
 *   de login completo mientras se desarrollan otras features.
 *   ⚠️ En producción, el login debe hacerse a través del formulario
 *   de autenticación real con credenciales del usuario.
 *
 * QUIÉN LA LLAMA:
 *   Middleware de Next.js o Server Components de inicialización cuando
 *   detectan que no hay token activo en las cookies.
 *
 * @returns El token de autenticación como string, o null si el login falla.
 */
export async function loginSilent(): Promise<string | null> {
  try {
    // Paso 1: Construir URL del endpoint.
    // Usa NEXT_PUBLIC_BACKEND_API_URL del entorno; fallback al dominio de Herd local.
    // NEXT_PUBLIC_ significa que esta variable es accesible también en el cliente,
    // pero aquí se usa solo en el servidor para construir la URL.
    const baseUrl = env.NEXT_PUBLIC_BACKEND_API_URL || 'https://localhost:8000';
    const loginUrl = `${baseUrl}/api/autenticacion/iniciar-sesion`;

    // Credenciales de prueba — solo para desarrollo/testing.
    // Usuario técnico con acceso limitado al sistema GIMA.
    const credentials = {
      email: 'tecnico@test.com',
      password: '12345678',
    };

    console.log(`[Auth] Intentando login en: ${loginUrl}`);

    // Paso 2: POST al endpoint de autenticación de Laravel Sanctum.
    // Accept: application/json es necesario para que Laravel retorne JSON
    // en lugar de HTML (que es el default cuando hay errores de validación).
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    // Paso 3: Verificar respuesta HTTP.
    // !response.ok cubre todos los casos de error (400, 401, 422, 500, etc.)
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Auth] Error de login (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();

    // Paso 4: Extraer token de la respuesta.
    // El backend GIMA sigue la convención `estado: 'exito'` para respuestas
    // exitosas. El token Sanctum está anidado en `data.data.token`.
    if (data.estado === 'exito' && data.data?.token) {
      const token = data.data.token;

      // Paso 5: Guardar token en cookie HTTP-only.
      // `cookies()` de next/headers es la API de Next.js 15 para manipular
      // cookies desde Server Actions y Server Components.
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true, // No accesible desde JS del cliente (anti-XSS)
        secure: process.env.NODE_ENV === 'production', // Solo HTTPS en producción
        sameSite: 'lax', // Protección CSRF básica
        path: '/', // Disponible en todas las rutas
        maxAge: 60 * 60 * 24 * 7, // Expiración: 7 días (604,800 segundos)
      });

      console.log('[Auth] Login exitoso, token guardado en cookie.');
      return token;
    }

    // El backend respondió 2xx pero la estructura no es la esperada.
    // Puede indicar un cambio en la API o un error de configuración.
    console.error('[Auth] Respuesta de login inesperada:', data);
    return null;
  } catch (error) {
    // Errores de red (ECONNREFUSED, timeout) u otros errores inesperados.
    // En desarrollo, típicamente indica que el backend Laravel no está corriendo.
    console.error('[Auth] Excepción en loginSilent:', error);
    return null;
  }
}

// ============================================================
// ACTION 2: getAuthToken
// ============================================================

/**
 * Obtiene el token de autenticación guardado en las cookies del servidor.
 *
 * QUÉ HACE:
 *   Lee la cookie `auth_token` del request actual usando la API de cookies
 *   de Next.js y retorna su valor. Usado por otras Server Actions y
 *   Server Components que necesitan autenticarse con el backend Laravel.
 *
 * CÓMO FUNCIONA:
 *   1. Obtiene el cookieStore del contexto del request actual (Next.js 15 async).
 *   2. Lee la cookie por su nombre constante `AUTH_COOKIE_NAME`.
 *   3. Retorna el valor del token o `undefined` si la cookie no existe
 *      (sesión expirada o usuario no autenticado).
 *
 * POR QUÉ RETORNA `undefined` Y NO `null`:
 *   Consistencia con la API de Next.js: `cookieStore.get()` retorna
 *   `undefined` cuando la cookie no existe, y se respeta ese contrato
 *   para no añadir una transformación innecesaria.
 *
 * QUIÉN LA LLAMA:
 *   Cualquier Server Action que necesite incluir el token en llamadas al
 *   backend Laravel de GIMA (ej. acciones de inventario, órdenes de trabajo).
 *
 * @returns El token de autenticación Sanctum, o `undefined` si no hay sesión activa.
 */
export async function getAuthToken(): Promise<string | undefined> {
  // `cookies()` en Next.js 15 es async — retorna una promesa que resuelve
  // al ReadonlyRequestCookies del request actual.
  const cookieStore = await cookies();

  // `.get()` retorna undefined si la cookie no existe (no lanza error).
  // `.value` es el string del token cuando la cookie existe.
  const tokenCookie = cookieStore.get(AUTH_COOKIE_NAME);
  return tokenCookie?.value;
}
