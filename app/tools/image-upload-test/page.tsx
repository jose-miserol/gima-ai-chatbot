/**
 * Image Upload Test Page
 *
 * Server component for testing image upload and analysis functionality.
 */

import { ImageUploadTestClient } from './image-upload-test-client';

import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Image Upload Test | GIMA AI',
    description: 'Test image analysis with Gemini Vision',
};

/**
 * Image Upload Test Page
 *
 * Testing tool for validating image upload and analysis functionality.
 * Allows developers to verify that the analyzePartImage Server Action is working correctly
 * with various image types and sizes.
 *
 * @returns Server component that renders the ImageUploadTestClient
 */
export default function ImageUploadTestPage() {
    return <ImageUploadTestClient />;
}
