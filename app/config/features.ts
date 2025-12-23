/**
 * Feature Flags System
 *
 * Controla el rollout gradual de nuevas funcionalidades
 * Permite A/B testing y activación por usuario
 *
 * @example
 * ```typescript
 * import { isFeatureEnabled, FEATURE_FLAGS } from '@/app/config/features';
 *
 * if (isFeatureEnabled('voiceCommands', user.email)) {
 *   // Renderizar feature
 * }
 * ```
 */

import { z } from 'zod';

/**
 * Schema de validación para variables de entorno de features
 */
const envSchema = z.object({
  NEXT_PUBLIC_FEATURE_VOICE_COMMANDS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
  NEXT_PUBLIC_FEATURE_PDF_READER: z
    .enum(['true', 'false'])
    .default('false')
    .transform((val) => val === 'true'),
});

/**
 * Variables de entorno parseadas y validadas
 */
const env = envSchema.parse({
  NEXT_PUBLIC_FEATURE_VOICE_COMMANDS: process.env.NEXT_PUBLIC_FEATURE_VOICE_COMMANDS || 'false',
  NEXT_PUBLIC_FEATURE_PDF_READER: process.env.NEXT_PUBLIC_FEATURE_PDF_READER || 'false',
});

/**
 * Configuración de rollout para una feature
 */
interface FeatureRollout {
  /** Porcentaje de usuarios con acceso (0-100) */
  percentage: number;
  /** Lista de emails con acceso garantizado (beta testers) */
  allowlist: string[];
}

/**
 * Configuración de una feature flag
 */
interface FeatureConfig {
  /** Feature habilitada globalmente */
  enabled: boolean;
  /** Configuración de rollout gradual */
  rollout: FeatureRollout;
}

/**
 * Todas las feature flags disponibles
 */
export const FEATURE_FLAGS = {
  voiceCommands: {
    enabled: env.NEXT_PUBLIC_FEATURE_VOICE_COMMANDS,
    rollout: {
      percentage: 25, // 25% de usuarios por defecto
      allowlist: [
        // Agregar emails de beta testers aquí
        // 'admin@uneg.edu.ve',
        // 'tecnico@uneg.edu.ve',
      ] as string[],
    },
  },
  pdfReader: {
    enabled: env.NEXT_PUBLIC_FEATURE_PDF_READER,
    rollout: {
      percentage: 0, // Rollout desactivado por defecto
      allowlist: [
        // Agregar emails de beta testers aquí
      ] as string[],
    },
  },
} satisfies Record<string, FeatureConfig>;

/**
 * Tipo que representa las features disponibles
 */
export type FeatureName = keyof typeof FEATURE_FLAGS;

/**
 * Genera un hash numérico simple de un string
 * Usado para distribución consistente de rollout
 *
 * @param str - String a hashear (ej: email de usuario)
 * @returns Número hash positivo
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Verifica si una feature está habilitada para un usuario específico
 *
 * Lógica de decisión:
 * 1. Si feature está deshabilitada globalmente → false
 * 2. Si usuario está en allowlist → true
 * 3. Si rollout percentage cubre al usuario (por hash) → true
 * 4. De lo contrario → false
 *
 * @param feature - Nombre de la feature
 * @param userId - Identificador del usuario (email, ID, etc.)
 * @returns true si la feature debe mostrarse al usuario
 *
 * @example
 * ```typescript
 * const canUseVoice = isFeatureEnabled('voiceCommands', 'user@example.com');
 * ```
 */
export function isFeatureEnabled(feature: FeatureName, userId?: string): boolean {
  const config = FEATURE_FLAGS[feature];

  // Feature deshabilitada globalmente
  if (!config.enabled) {
    return false;
  }

  // Usuario en allowlist siempre tiene acceso
  if (userId && config.rollout.allowlist.includes(userId)) {
    return true;
  }

  // Rollout al 100% → todos tienen acceso
  if (config.rollout.percentage === 100) {
    return true;
  }

  // Rollout al 0% → solo allowlist
  if (config.rollout.percentage === 0) {
    return false;
  }

  // Rollout basado en porcentaje (consistente por userId)
  if (userId) {
    const hash = simpleHash(userId);
    return hash % 100 < config.rollout.percentage;
  }

  // Sin userId, aplicar percentage de forma aleatoria
  // (no recomendado - preferible siempre pasar userId)
  return Math.random() * 100 < config.rollout.percentage;
}

/**
 * Obtiene la configuración completa de una feature
 *
 * @param feature - Nombre de la feature
 * @returns Configuración de la feature
 */
export function getFeatureConfig(feature: FeatureName): FeatureConfig {
  return FEATURE_FLAGS[feature];
}

/**
 * Verifica si todas las features especificadas están habilitadas
 *
 * @param features - Array de nombres de features
 * @param userId - Identificador del usuario
 * @returns true solo si TODAS las features están habilitadas
 *
 * @example
 * ```typescript
 * const canUseBoth = areAllFeaturesEnabled(['voiceCommands', 'pdfReader'], userId);
 * ```
 */
export function areAllFeaturesEnabled(features: FeatureName[], userId?: string): boolean {
  return features.every((feature) => isFeatureEnabled(feature, userId));
}

/**
 * Verifica si al menos una de las features está habilitada
 *
 * @param features - Array de nombres de features
 * @param userId - Identificador del usuario
 * @returns true si AL MENOS UNA feature está habilitada
 */
export function isAnyFeatureEnabled(features: FeatureName[], userId?: string): boolean {
  return features.some((feature) => isFeatureEnabled(feature, userId));
}

/**
 * Hook para React Server Components
 * Obtiene el estado de una feature en servidor
 *
 * @param feature - Nombre de la feature
 * @param userId - Identificador del usuario
 * @returns Estado de la feature
 */
export function getServerFeatureState(
  feature: FeatureName,
  userId?: string
): {
  enabled: boolean;
  reason: 'disabled' | 'allowlist' | 'rollout' | 'not-in-rollout';
} {
  const config = FEATURE_FLAGS[feature];

  if (!config.enabled) {
    return { enabled: false, reason: 'disabled' };
  }

  if (userId && config.rollout.allowlist.includes(userId)) {
    return { enabled: true, reason: 'allowlist' };
  }

  if (userId) {
    const hash = simpleHash(userId);
    const inRollout = hash % 100 < config.rollout.percentage;
    return {
      enabled: inRollout,
      reason: inRollout ? 'rollout' : 'not-in-rollout',
    };
  }

  return { enabled: false, reason: 'not-in-rollout' };
}
