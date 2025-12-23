'use client';

/**
 * Feature Guard Component
 *
 * Componente de React para mostrar/ocultar features basado en feature flags
 * Útil para rollout gradual y A/B testing
 *
 * @example
 * ```tsx
 * <FeatureGuard feature="voiceCommands">
 *   <VoiceCommandButton />
 * </FeatureGuard>
 * ```
 */

import { type ReactNode } from 'react';
import { isFeatureEnabled, type FeatureName } from '@/app/config/features';

interface FeatureGuardProps {
  /** Nombre de la feature a verificar */
  feature: FeatureName;
  /** Identificador del usuario (email, user ID, etc.) */
  userId?: string;
  /** Contenido a mostrar si la feature NO está habilitada */
  fallback?: ReactNode;
  /** Contenido a mostrar si la feature está habilitada */
  children: ReactNode;
  /** Callback cuando feature no está disponible (para analytics) */
  onFeatureUnavailable?: () => void;
}

/**
 * Componente que controla visibilidad basado en feature flags
 *
 * Esconde el contenido si la feature no está habilitada para el usuario.
 * Opcionalmente muestra un fallback en su lugar.
 *
 * @example
 * ```tsx
 * // Básico: mostrar u ocultar
 * <FeatureGuard feature="pdfReader">
 *   <PDFUploader />
 * </FeatureGuard>
 *
 * // Con fallback
 * <FeatureGuard
 *   feature="voiceCommands"
 *   fallback={<ComingSoonBadge />}
 * >
 *   <VoiceButton />
 * </FeatureGuard>
 *
 * // Con userId específico
 * <FeatureGuard
 *   feature="pdfReader"
 *   userId={session?.user?.email}
 * >
 *   <PDFUploader />
 * </FeatureGuard>
 * ```
 */
export function FeatureGuard({
  feature,
  userId,
  fallback = null,
  children,
  onFeatureUnavailable,
}: FeatureGuardProps) {
  const enabled = isFeatureEnabled(feature, userId);

  // Feature no habilitada - ejecutar callback si existe
  if (!enabled && onFeatureUnavailable) {
    onFeatureUnavailable();
  }

  // Mostrar contenido o fallback
  return <>{enabled ? children : fallback}</>;
}

/**
 * Variante del FeatureGuard que renderiza solo en servidor
 * Útil para evitar flash de contenido en cliente
 */
interface ServerFeatureGuardProps extends FeatureGuardProps {
  /** Fuerza rendering solo en servidor */
  serverOnly?: boolean;
}

/**
 * Hook personalizado para verificar feature flags
 * Útil cuando no quieres usar el componente guard
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const canUseVoice = useFeature('voiceCommands');
 *
 *   return (
 *     <div>
 *       {canUseVoice && <VoiceButton />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useFeature(feature: FeatureName, userId?: string): boolean {
  return isFeatureEnabled(feature, userId);
}

/**
 * Componente de badge para features "Coming Soon"
 * Útil como fallback en FeatureGuard
 */
export function ComingSoonBadge({ feature }: { feature: FeatureName }) {
  return (
    <div
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
      title={`${feature} estará disponible próximamente`}
    >
      <span className="mr-1">🚀</span>
      Próximamente
    </div>
  );
}

/**
 * Componente de tooltip para features bloqueadas
 */
export function FeatureLockedMessage({
  message = 'Esta funcionalidad no está disponible para tu cuenta',
}: {
  message?: string;
}) {
  return (
    <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-200">{message}</p>
        </div>
      </div>
    </div>
  );
}
