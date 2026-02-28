/**
 * PDF Upload Test Client Component
 *
 * Interactive testing tool for PDF analysis functionality using Gemini.
 * Provides file upload via input or drag-and-drop, real-time validation, custom prompt input,
 * and displays analysis/extraction results from the analyzePdf Server Action.
 *
 * **Why this exists:**
 * Enables developers and QA to quickly verify that PDF uploads, content extraction,
 * and AI analysis are working correctly. Particularly useful for testing custom prompts
 * and validating file size limits.
 *
 * @returns Client component with PDF upload testing interface
 */

'use client';

import { FileText, Upload, X, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { analyzePdf } from '@/app/actions';
import { AIToolLayout } from '@/app/components/features/ai-tools/shared';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Separator } from '@/app/components/ui/separator';
import { Textarea } from '@/app/components/ui/textarea';
import { useFileUpload } from '@/app/hooks/use-file-upload';
import { useToast } from '@/app/components/ui/toast';

const MAX_SIZE_MB = 20;
const ACCEPTED_TYPE = 'application/pdf';

export function PdfUploadTestClient() {
    const toast = useToast();
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<string>('');
    const [error, setError] = useState<string>('');

    const {
        selectedFile,
        preview: pdfDataUrl,
        fileInputRef,
        handleFileInput,
        handleDrop,
        handleDragOver,
        handleReset,
    } = useFileUpload({
        maxSizeMB: MAX_SIZE_MB,
        acceptedTypes: [ACCEPTED_TYPE],
        onFileSelect: () => {
            setResult('');
            setError('');
        },
    });

    const handleAnalyze = async () => {
        if (!selectedFile || !pdfDataUrl) return;

        setIsAnalyzing(true);
        setResult('');
        setError('');

        try {
            const prompt = customPrompt.trim() || undefined;
            const formData = new FormData();
            formData.append('file', selectedFile);
            if (prompt) formData.append('prompt', prompt);

            const response = await analyzePdf(formData);

            if (response.success) {
                setResult(response.text);
                toast.success('✅ Análisis completado', 'El PDF fue analizado exitosamente');
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
        setCustomPrompt('');
        setResult('');
        setError('');
    };

    return (
        <AIToolLayout
            title="PDF Upload Test"
            description="Test PDF content extraction and analysis with Gemini"
            icon={<FileText className="h-8 w-8" />}
            helpContent={
                <div className="space-y-2 text-sm">
                    <p><strong>Testing Guide</strong></p>
                    <div>
                        <p className="font-medium mb-1">✅ Valid Test:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Upload PDF &lt; 20MB</li>
                            <li>Add custom prompt (optional)</li>
                            <li>Click "Analyze PDF"</li>
                        </ul>
                    </div>
                    <div className="mt-2">
                        <p className="font-medium mb-1">❌ Error Tests:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Try file &gt; 20MB</li>
                            <li>Try non-PDF file</li>
                            <li>Verify error messages</li>
                        </ul>
                    </div>
                    <div className="mt-2">
                        <p className="font-medium mb-1">💡 Custom Prompts:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>"Summarize in 3 bullet points"</li>
                            <li>"Extract all numerical data"</li>
                        </ul>
                    </div>
                </div>
            }
        >
            {/* Left Column - Form */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Upload PDF</CardTitle>
                        <CardDescription>
                            Select or drag a PDF to test analysis (max {MAX_SIZE_MB}MB)
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
                                Accepted: PDF only
                            </p>
                        </div>

                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept=".pdf,application/pdf"
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
                                        <span className="font-medium truncate ml-2">{selectedFile.name}</span>
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

                        {/* Custom Prompt */}
                        {selectedFile && (
                            <>
                                <Separator />
                                <div className="space-y-2">
                                    <Label htmlFor="custom-prompt">
                                        Custom Prompt (Optional)
                                    </Label>
                                    <Textarea
                                        id="custom-prompt"
                                        placeholder="e.g., Extract all dates and names from this document"
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        rows={3}
                                        className="resize-none"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Leave empty to use default analysis prompt
                                    </p>
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
                                        <FileText className="mr-2 h-4 w-4" />
                                        Analyze PDF
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
                            AI-generated analysis from Gemini
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {result ? (
                            <div className="prose prose-sm max-w-none">
                                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap max-h-[500px] overflow-y-auto">
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
                                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                                <p>Upload and analyze a PDF to see results</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AIToolLayout>
    );
}
