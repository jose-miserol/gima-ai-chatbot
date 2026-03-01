'use server';

import { cookies } from 'next/headers';
import { env } from '@/app/config/env';

// Desactivar validación de certificados local (Herd SSL Self-Signed workaround)
if (process.env.NODE_ENV === 'development') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

/**
 * Nombre de la cookie donde se almacenará el token Sanctum
 */
const AUTH_COOKIE_NAME = 'auth_token';

/**
 * Realiza un login automático utilizando credenciales hardcodeadas (solo para desarrollo/pruebas).
 * Hace un POST a la ruta de inicio de sesión de Laravel.
 */
export async function loginSilent(): Promise<string | null> {
  try {
    const baseUrl = env.NEXT_PUBLIC_BACKEND_API_URL || 'https://gima-backend.test';
    const loginUrl = `${baseUrl}/api/autenticacion/iniciar-sesion`;

    // ... (rest omitted to not override whole file at once, I will just replace the specific lines)

    // Credenciales de prueba solicitadas por el usuario
    const credentials = {
      email: 'tecnico@test.com',
      password: '12345678',
    };

    console.log(`[Auth] Intentando login en: ${loginUrl}`);

    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Auth] Error de login (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();

    // Asumiendo que el backend retorna 'estado' => 'exito' y data['token']
    if (data.estado === 'exito' && data.data?.token) {
      const token = data.data.token;

      // Guardar el token en una cookie HTTP-only
      const cookieStore = await cookies();
      cookieStore.set(AUTH_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 semana
      });

      console.log('[Auth] Login exitoso, token guardado en cookie.');
      return token;
    }

    console.error('[Auth] Respuesta de login inesperada:', data);
    return null;
  } catch (error) {
    console.error('[Auth] Excepción en loginSilent:', error);
    return null;
  }
}

/**
 * Obtiene el token de autenticación guardado en las cookies.
 */
export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(AUTH_COOKIE_NAME);
  return tokenCookie?.value;
}
