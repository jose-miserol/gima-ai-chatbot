// ✅ Barrel export - SOLO para exportar hacia el exterior
// Regla: NO importar desde este index.ts dentro de features/chat/
// Usar rutas relativas directas (./component-name) dentro de la feature
export { Chat } from './chat';
export { ChatMessageSkeleton } from './chat-message-skeleton';
