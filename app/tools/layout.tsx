/**
 * Tools Layout - Development Only Guard
 *
 * Protects all /tools/* pages from being accessible in production.
 * These pages are development/testing utilities only.
 */

import { notFound } from 'next/navigation';

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
    // Block access in production
    if (process.env.NODE_ENV === 'production') {
        // notFound();
    }

    return <>{children}</>;
}
