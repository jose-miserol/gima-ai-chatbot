'use client';

import dynamic from 'next/dynamic';

const Chat = dynamic(
  () => import('@components/features/chat').then((mod) => ({ default: mod.Chat })),
  {
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen">Cargando...</div>,
  }
);

/**
 *
 */
export default function ChatPage() {
  return <Chat />;
}
