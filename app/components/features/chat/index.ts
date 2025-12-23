// ✅ Barrel export - SOLO para exportar hacia el exterior
// Regla: NO importar desde este index.ts dentro de features/chat/
// Usar rutas relativas dir// Componente principal
export { Chat } from './chat';

// Subcomponentes (Fase 2)
export { ChatHeader } from './chat-header';
export { ChatConversation } from './chat-conversation';
export { ChatMessage } from './chat-message';
export { ChatInputArea } from './chat-input-area';
export { ChatStatusIndicators } from './chat-status-bar';
export { ChatMessageSkeleton } from './chat-message-skeleton';
export { ChatEmptyState } from './chat-empty-state';

// Re-exportar todos los hooks (Fase 1 + existentes)
export * from './hooks';

// Re-exportar todos los tipos
export type * from './types';
