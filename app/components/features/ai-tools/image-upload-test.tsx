/**
 * Image Upload Test Client Component
 *
 * Interactive testing tool for the image analysis functionality using Gemini Vision.
 * Provides file upload via input or drag-and-drop, real-time validation, image preview,
 * and displays analysis results from the analyzePartImage Server Action.
 *
 * **Why this exists:**
 * Enables developers and QA to quickly verify that image uploads and AI analysis
 * are working correctly without needing to navigate through the full application flow.
 *
 * @returns Client component with image upload testing interface
 */

'use client';

import { ImageIcon, Upload, X, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { analyzePartImage } from '@/app/actions';
import { AIToolLayout } from '@/app/components/features/ai-tools/shared';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';
import { useFileUpload } from '@/app/hooks/use-file-upload';
import { useToast } from '@/app/components/ui/toast';

const MAX_SIZE_MB = 10;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export function ImageUploadTestClient() {
    const toast = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<string>('');
    const [error, setError] = useState<string>('');

    const {
        selectedFile,
        preview,
        fileInputRef,
        handleFileInput,
        handleDrop,
        handleDragOver,
        handleReset,
    } = useFileUpload({
        maxSizeMB: MAX_SIZE_MB,
        acceptedTypes: ACCEPTED_TYPES,
        onFileSelect: () => {
            setResult('');
            setError('');
        },
    });

    const handleAnalyze = async () => {
        if (!selectedFile || !preview) return;

        setIsAnalyzing(true);
        setResult('');
        setError('');

        try {
            const response = await analyzePartImage(preview, selectedFile.type);

            if (response.success) {
                setResult(response.text);
                toast.success('✅ Análisis completado', 'La imagen fue analizada exitosamente');
            } else {
                setError(response.error || 'Error desconocido');
                toast.error('❌ Error en análisis', response.error);
            }
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
            setError(errorMsg);
            toast.error('❌ Error', errorMsg);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const reset = () => {
        handleReset();
        setResult('');
        setError('');
    };

    return (
        <AIToolLayout
            title="Image Upload Test"
            description="Test image analysis functionality with Gemini Vision"
            icon={<ImageIcon className="h-8 w-8" />}
            helpContent={
                <div className="space-y-2 text-sm">
                    <p><strong>Testing Guide</strong></p>
                    <div>
                        <p className="font-medium mb-1">✅ Valid Test:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Upload image &lt; 10MB</li>
                            <li>Click "Analyze Image"</li>
                            <li>Check result appears</li>
                        </ul>
                    </div>
                    <div className="mt-2">
                        <p className="font-medium mb-1">❌ Error Tests:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Try file &gt; 10MB</li>
                            <li>Try non-image file</li>
                            <li>Verify error messages</li>
                        </ul>
                    </div>
                </div>
            }
        >
            {/* Left Column - Form */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload Image</CardTitle>
                        <CardDescription>
                            Select or drag an image to test analysis (max {MAX_SIZE_MB}MB)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Drop Zone */}
                        <div
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground mb-2">
                                Drag & drop or click to select
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Accepted: JPG, PNG, WebP, GIF
                            </p>
                        </div>

                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept={ACCEPTED_TYPES.join(',')}
                            onChange={handleFileInput}
                            className="hidden"
                        />

                        {/* File Info */}
                        {selectedFile && (
                            <>
                                <Separator />
                                <div className="text-sm space-y-1">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Filename:</span>
                                        <span className="font-medium">{selectedFile.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Type:</span>
                                        <span className="font-medium">{selectedFile.type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Size:</span>
                                        <span className="font-medium">
                                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                                        </span>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Preview */}
                        {preview && (
                            <>
                                <Separator />
                                <div>
                                    <Label className="mb-2 block">Preview</Label>
                                    <div className="relative rounded-lg overflow-hidden border bg-muted/20">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={preview}
                                            alt="Preview"
                                            className="w-full h-auto max-h-64 object-contain"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={handleAnalyze}
                                disabled={!selectedFile || isAnalyzing}
                                className="flex-1"
                            >
                                {isAnalyzing ? (
                                    <>
                                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        Analyze Image
                                    </>
                                )}
                            </Button>
                            <Button onClick={reset} variant="outline" disabled={!selectedFile}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column - Results */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Analysis Result</CardTitle>
                        <CardDescription>
                            AI-generated analysis from Gemini Vision
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {result ? (
                            <div className="prose prose-sm max-w-none">
                                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap">
                                    {result}
                                </div>
                            </div>
                        ) : error ? (
                            <div className="bg-destructive/10 text-destructive rounded-lg p-4">
                                <p className="font-medium mb-1">Error:</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground">
                                <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Upload and analyze an image to see results</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AIToolLayout>
    );
}
