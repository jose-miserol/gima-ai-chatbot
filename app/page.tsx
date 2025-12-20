'use client';

import dynamic from 'next/dynamic';

const ChatInterfaceV1 = dynamic(
  () => import('@/features/chat').then((mod) => ({ default: mod.ChatInterfaceV1 })),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen">Cargando...</div>,
  }
);

export default function ChatPage() {
  return <ChatInterfaceV1 />;
}
