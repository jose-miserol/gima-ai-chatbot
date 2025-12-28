/**
 * IP Utilities - Validación y extracción de direcciones IP
 *
 * Proporciona funciones para validar formatos de IP y extraer
 * la dirección del cliente desde headers HTTP.
 * @module ip-utils
 */

import { NextResponse } from 'next/server';

// ===========================================
// Constants
// ===========================================

/**
 * Regex para validar direcciones IPv4
 * Formato: xxx.xxx.xxx.xxx donde xxx es 0-255
 */
const IPV4_REGEX =
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

/**
 * Regex para validar direcciones IPv6 (simplificado)
 * Soporta formato completo y abreviado con ::
 */
const IPV6_REGEX =
  /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^(?:[0-9a-fA-F]{1,4}:){1,7}:$|^(?:[0-9a-fA-F]{1,4}:){0,6}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$/;

// ===========================================
// Validation Functions
// ===========================================

/**
 * Valida si un string es una dirección IP válida (IPv4 o IPv6)
 * @param ip - String a validar
 * @returns true si es una IP válida
 * @example
 * isValidIP('192.168.1.1')     // true
 * isValidIP('::1')             // true
 * isValidIP('invalid')         // false
 * isValidIP('unknown')         // false
 */
export function isValidIP(ip: string): boolean {
  if (!ip || ip === 'unknown') return false;
  return IPV4_REGEX.test(ip) || IPV6_REGEX.test(ip);
}

// ===========================================
// Extraction Functions
// ===========================================

/**
 * Opciones para la extracción de IP
 */
export interface ExtractIPOptions {
  /** Si es true, retorna 'localhost' cuando no hay IP válida (útil para desarrollo) */
  allowLocalhost?: boolean;
}

/**
 * Extrae la IP del cliente del request HTTP
 *
 * Busca en los headers estándar de proxy:
 * 1. x-forwarded-for (primera IP de la lista)
 * 2. x-real-ip
 * @param req - Request HTTP entrante
 * @param options - Opciones de extracción
 * @returns IP del cliente o null si no se puede determinar o es inválida
 * @example
 * // En producción
 * const ip = extractClientIP(req);
 * if (!ip) return createInvalidIPResponse();
 *
 * // En desarrollo
 * const ip = extractClientIP(req, { allowLocalhost: true });
 */
export function extractClientIP(req: Request, options?: ExtractIPOptions): string | null {
  const forwardedFor = req.headers.get('x-forwarded-for');

  // x-forwarded-for puede tener múltiples IPs separadas por coma
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0].trim();
    if (isValidIP(firstIP)) return firstIP;
  }

  const realIP = req.headers.get('x-real-ip');
  if (realIP && isValidIP(realIP)) return realIP;

  // Permitir localhost en desarrollo
  if (options?.allowLocalhost) return 'localhost';

  return null;
}

// ===========================================
// Response Functions
// ===========================================

/**
 * Crea respuesta de error por IP inválida o no proporcionada
 * @returns NextResponse con status 400
 */
export function createInvalidIPResponse(): NextResponse {
  return NextResponse.json(
    {
      error: 'Invalid or missing client IP',
      message: 'Unable to identify client. Please try again or contact support.',
    },
    { status: 400 }
  );
}
