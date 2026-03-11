/**
 * PDF Upload Test Page
 *
 * Server component for testing PDF upload and analysis functionality.
 */

import { PdfUploadTestClient } from '@/app/components/features/ai-tools/pdf-upload-test';

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Análisis de PDF | GIMA',
    description: 'Extrae y analiza contenido de documentos PDF',
};

/**
 * PDF Upload Test Page
 *
 * Testing tool for validating PDF upload and analysis functionality.
 * Allows developers to verify that the analyzePdf Server Action is working correctly
 * with various PDF files and custom prompts.
 *
 * @returns Server component that renders the PdfUploadTestClient
 */
export default function PdfUploadTestPage() {
    return <PdfUploadTestClient />;
}
