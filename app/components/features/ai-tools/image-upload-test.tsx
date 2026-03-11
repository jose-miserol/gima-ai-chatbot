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

import { analyzePartImage } from '@/app/actions/vision';
import type { PartAnalysisResult } from '@/app/lib/schemas/vision.schema';
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
    const [result, setResult] = useState<PartAnalysisResult | null>(null);
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
            setResult(null);
            setError('');
        },
    });

    const handleAnalyze = async () => {
        if (!selectedFile || !preview) return;

        setIsAnalyzing(true);
        setResult(null);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);
            const response = await analyzePartImage(formData);

            if (response.success && response.result) {
                setResult(response.result);
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
        setResult(null);
        setError('');
    };

    return (
        <AIToolLayout
            title="Prueba de Carga de Imágenes"
            description="Prueba la funcionalidad de análisis de imágenes con Gemini Vision"
            icon={<ImageIcon className="h-8 w-8" />}
            helpContent={
                <div className="space-y-2 text-sm">
                    <p><strong>Guía de Pruebas</strong></p>
                    <div>
                        <p className="font-medium mb-1">✅ Prueba Válida:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Sube una imagen &lt; 10MB</li>
                            <li>Haz clic en "Analizar Imagen"</li>
                            <li>Verifica que aparezca el resultado</li>
                        </ul>
                    </div>
                    <div className="mt-2">
                        <p className="font-medium mb-1">❌ Pruebas de Error:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Prueba un archivo &gt; 10MB</li>
                            <li>Prueba un archivo que no sea imagen</li>
                            <li>Verifica los mensajes de error</li>
                        </ul>
                    </div>
                </div>
            }
        >
            {/* Left Column - Form */}
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Subir Imagen</CardTitle>
                        <CardDescription>
                            Selecciona o arrastra una imagen para probar el análisis (máx {MAX_SIZE_MB}MB)
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
                                Aceptados: JPG, PNG, WebP, GIF
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
                                        <span className="text-muted-foreground">Nombre de archivo:</span>
                                        <span className="font-medium">{selectedFile.name}</span>
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

                        {/* Preview */}
                        {preview && (
                            <>
                                <Separator />
                                <div>
                                    <Label className="mb-2 block">Previsualización</Label>
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
                                        Analizando...
                                    </>
                                ) : (
                                    <>
                                        <ImageIcon className="mr-2 h-4 w-4" />
                                        Analizar Imagen
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
                            Análisis generado por IA desde Gemini Vision
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {result ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="bg-muted p-3 rounded-lg">
                                        <p className="font-semibold text-xs text-muted-foreground uppercase">TIPO</p>
                                        <p className="capitalize">{result.tipo_articulo}</p>
                                    </div>
                                    <div className="bg-muted p-3 rounded-lg">
                                        <p className="font-semibold text-xs text-muted-foreground uppercase">ESTADO FÍSICO</p>
                                        <p className="capitalize">{result.estado_fisico.replace('_', ' ')}</p>
                                    </div>
                                </div>

                                <div className="bg-muted/50 p-4 rounded-lg">
                                    <h4 className="font-medium text-sm mb-2">Descripción</h4>
                                    <p className="text-sm text-muted-foreground">{result.descripcion}</p>
                                </div>

                                <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div className="bg-muted/30 border p-3 rounded-lg">
                                        <p className="font-semibold text-xs text-muted-foreground uppercase">MARCA</p>
                                        <p>{result.marca || 'N/A'}</p>
                                    </div>
                                    <div className="bg-muted/30 border p-3 rounded-lg">
                                        <p className="font-semibold text-xs text-muted-foreground uppercase">MODELO</p>
                                        <p>{result.modelo || 'N/A'}</p>
                                    </div>
                                    <div className="bg-muted/30 border p-3 rounded-lg">
                                        <p className="font-semibold text-xs text-muted-foreground uppercase">CANTIDAD</p>
                                        <p>{result.cantidad_detectada}</p>
                                    </div>
                                </div>

                                <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                                    <h4 className="font-medium text-sm text-primary mb-1">Recomendación</h4>
                                    <p className="text-sm">{result.recomendacion}</p>
                                </div>

                                <div className="text-xs text-right text-muted-foreground">
                                    Confianza IA: <span className="font-medium capitalize">{result.nivel_confianza}</span>
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
                                <p>Sube y analiza una imagen para ver los resultados</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AIToolLayout>
    );
}
