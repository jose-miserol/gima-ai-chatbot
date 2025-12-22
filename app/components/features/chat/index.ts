// ✅ Barrel export - SOLO para exportar hacia el exterior
// Regla: NO importar desde este index.ts dentro de features/chat/
// Usar rutas relativas dir// Main component
export { Chat } from './chat';

// Subcomponents (Phase 2)
export { ChatHeader } from './chat-header';
export { ChatConversation } from './chat-conversation';
export { ChatMessage } from './chat-message';
export { ChatInputArea } from './chat-input-area';
export { ChatStatusIndicators } from './chat-status-bar';
export { ChatMessageSkeleton } from './chat-message-skeleton';
export { ChatEmptyState } from './chat-empty-state';

// Re-export all hooks (Phase 1 + existing)
export * from './hooks';

// Re-export all types
export type * from './types';
