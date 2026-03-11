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
            title="Prueba de Carga de PDF"
            description="Prueba la extracción y análisis de contenido PDF con Gemini"
            icon={<FileText className="h-8 w-8" />}
            helpContent={
                <div className="space-y-2 text-sm">
                    <p><strong>Guía de Pruebas</strong></p>
                    <div>
                        <p className="font-medium mb-1">Prueba Válida:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Sube un PDF &lt; 20MB</li>
                            <li>Añade un prompt personalizado (opcional)</li>
                            <li>Haz clic en "Analizar PDF"</li>
                        </ul>
                    </div>
                    <div className="mt-2">
                        <p className="font-medium mb-1">Pruebas de Error:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Prueba un archivo &gt; 20MB</li>
                            <li>Prueba un archivo que no sea PDF</li>
                            <li>Verifica los mensajes de error</li>
                        </ul>
                    </div>
                    <div className="mt-2">
                        <p className="font-medium mb-1">Prompts Personalizados:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>"Resume en 3 viñetas"</li>
                            <li>"Extrae todos los datos numéricos"</li>
                        </ul>
                    </div>
                </div>
            }
        >
            {/* Left Column - Form */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Subir PDF</CardTitle>
                        <CardDescription>
                            Selecciona o arrastra un PDF para probar el análisis (máx {MAX_SIZE_MB}MB)
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
                                Arrastra y suelta o haz clic para seleccionar
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Aceptados: Solo PDF
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
                                        <span className="text-muted-foreground">Nombre de archivo:</span>
                                        <span className="font-medium truncate ml-2">{selectedFile.name}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tipo:</span>
                                        <span className="font-medium">{selectedFile.type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Tamaño:</span>
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
                                        Prompt Personalizado (Opcional)
                                    </Label>
                                    <Textarea
                                        id="custom-prompt"
                                        placeholder="Ej: Extrae todas las fechas y nombres de este documento"
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        rows={3}
                                        className="resize-none"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Deja vacío para usar el prompt de análisis por defecto
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
                                        Analizando...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="mr-2 h-4 w-4" />
                                        Analizar PDF
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
                        <CardTitle>Resultado del Análisis</CardTitle>
                        <CardDescription>
                            Análisis generado por IA desde Gemini
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
                                <p>Sube y analiza un PDF para ver los resultados</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AIToolLayout>
    );
}
