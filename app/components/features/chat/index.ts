// ✅ Barrel export - SOLO para exportar hacia el exterior
// Regla: NO importar desde este index.ts dentro de features/chat/
// Usar rutas relativas directas (./component-name) dentro de la feature
export { ChatInterfaceV1 } from './chat-interface';
export { MessageSkeleton } from './message-skeleton';
