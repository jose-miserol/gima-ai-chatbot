'use client';

import { Sparkles, Loader2, Save, RotateCcw, AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/app/lib/utils';

import { useDraft } from './hooks/use-draft';
import type { FormField } from './types';

/**
 * Props para AIGenerationForm
 */
export interface AIGenerationFormProps<T = Record<string, unknown>> {
  /** Título del formulario */
  title: string;
  /** Descripción breve */
  description?: string;
  /** Campos del formulario */
  fields: FormField[];
  /** Función al enviar */
  onSubmit: (data: T) => Promise<void> | void;
  /** Estado de generación */
  isGenerating?: boolean;
  /** Texto del botón submit */
  submitLabel?: string;
  /** Habilitar guardado de drafts en localStorage */
  saveDrafts?: boolean;
  /** ID único para el draft (requerido si saveDrafts=true) */
  draftId?: string;
  /** Clase CSS adicional */
  className?: string;
  /** Valores por defecto */
  defaultValues?: Partial<T>;
}

/**
 * Form genérico para generación con IA
 *
 * Features:
 * - Guardado automático de drafts en localStorage (cada 30s)
 * - Keyboard shortcut: Ctrl/Cmd+Enter para submit
 * - Character counter para textarea
 * - Indicador de cambios sin guardar
 * - Advertencia al salir con cambios pendientes
 * - Botón para limpiar formulario
 */
export function AIGenerationForm<T = Record<string, unknown>>({
  title,
  description,
  fields,
  onSubmit,
  isGenerating = false,
  submitLabel = 'Generar',
  saveDrafts = false,
  draftId,
  className,
  defaultValues,
}: AIGenerationFormProps<T>) {
  // Inicializar datos con valores por defecto
  const initialData = (() => {
    const initial: Record<string, unknown> = {};
    fields.forEach((field) => {
      initial[field.name] = defaultValues?.[field.name as keyof T] ?? field.defaultValue ?? '';
    });
    return initial;
  })();

  const { data: formData, setData: setFormData, isDirty, lastSaved, save, clear } = useDraft(
    draftId,
    saveDrafts,
    initialData as T
  );

  const formRef = useRef<HTMLFormElement>(null);

  // Manejar submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData as T);
    if (saveDrafts) {
      clear();
    }
  };

  // Manejar cambio de campo
  const handleChange = (name: string, value: unknown) => {
    setFormData({ ...(formData as Record<string, unknown>), [name]: value } as T);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + Enter para submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isGenerating) {
          formRef.current?.requestSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isGenerating]);

  // Guardar draft manualmente
  const handleSaveDraft = () => {
    save();
  };

  // Limpiar formulario
  const handleClear = () => {
    clear();
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isDirty && (
              <Badge variant="outline" className="gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                Sin guardar
              </Badge>
            )}
            {lastSaved && !isDirty && (
              <span className="text-xs text-muted-foreground">
                Guardado: {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              {field.type !== 'checkbox' && (
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </Label>
              )}

              {field.type === 'text' && (
                <Input
                  id={field.name}
                  type="text"
                  placeholder={field.placeholder}
                  value={((formData as Record<string, unknown>)[field.name] as string) || ''}
                  onChange={(e) => handleChange(field.name, e.target.value)}
                  required={field.required}
                  maxLength={field.maxLength}
                  disabled={isGenerating}
                />
              )}

              {field.type === 'textarea' && (
                <div className="relative">
                  <Textarea
                    id={field.name}
                    placeholder={field.placeholder}
                    value={((formData as Record<string, unknown>)[field.name] as string) || ''}
                    onChange={(e) => handleChange(field.name, e.target.value)}
                    required={field.required}
                    maxLength={field.maxLength}
                    disabled={isGenerating}
                    rows={field.rows || 4}
                  />
                  {field.maxLength && (
                    <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                      {(((formData as Record<string, unknown>)[field.name] as string) || '').length}
                      /{field.maxLength}
                    </span>
                  )}
                </div>
              )}

              {field.type === 'select' && field.options && (
                <Select
                  value={((formData as Record<string, unknown>)[field.name] as string) || ''}
                  onValueChange={(value) => handleChange(field.name, value)}
                  disabled={isGenerating}
                >
                  <SelectTrigger id={field.name}>
                    <SelectValue placeholder={field.placeholder || 'Seleccionar...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {field.type === 'checkbox' && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={field.name}
                    checked={((formData as Record<string, unknown>)[field.name] as boolean) || false}
                    onCheckedChange={(checked) => handleChange(field.name, checked)}
                    disabled={isGenerating}
                  />
                  <label
                    htmlFor={field.name}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {field.label}
                    {field.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                </div>
              )}

              {field.type === 'number' && (
                <Input
                  id={field.name}
                  type="number"
                  placeholder={field.placeholder}
                  value={((formData as Record<string, unknown>)[field.name] as number) || ''}
                  onChange={(e) => handleChange(field.name, Number(e.target.value))}
                  required={field.required}
                  min={field.min}
                  max={field.max}
                  disabled={isGenerating}
                />
              )}

              {field.helpText && (
                <p className="text-xs text-muted-foreground">{field.helpText}</p>
              )}
            </div>
          ))}

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-2">
            <Button type="submit" disabled={isGenerating} className="w-full" size="lg">
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {submitLabel}
                </>
              )}
            </Button>

            <div className="flex gap-2">
              {saveDrafts && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={isGenerating || !isDirty}
                  className="flex-1"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar borrador
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isGenerating}
                className={saveDrafts ? 'flex-1' : 'w-full'}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            </div>

            {/* Keyboard shortcut hint */}
            <p className="text-xs text-muted-foreground text-center">
              Tip: Presiona <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl</kbd>
              +<kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Enter</kbd> para generar
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
