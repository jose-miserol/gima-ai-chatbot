/**
 * AIGenerationForm - Formulario genérico para generación con IA
 *
 * Componente reutilizable para todas las AI features.
 * Maneja validación, estados de carga y submit.
 */

'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Sparkles, Loader2 } from 'lucide-react';
import type { FormField } from './types';

/**
 * Props para AIGenerationForm
 */
export interface AIGenerationFormProps<T = Record<string, unknown>> {
  /**
   * Título del formulario
   */
  title: string;

  /**
   * Descripción breve
   */
  description?: string;

  /**
   * Campos del formulario
   */
  fields: FormField[];

  /**
   * Función al enviar
   */
  onSubmit: (data: T) => Promise<void> | void;

  /**
   * Estado de generación
   */
  isGenerating?: boolean;

  /**
   * Texto del botón submit
   */
  submitLabel?: string;

  /**
   * Clase CSS adicional
   */
  className?: string;
}

/**
 * Form genérico para generación con IA
 */
export function AIGenerationForm<T = Record<string, unknown>>({
  title,
  description,
  fields,
  onSubmit,
  isGenerating = false,
  submitLabel = 'Generar',
  className,
}: AIGenerationFormProps<T>) {
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    fields.forEach((field) => {
      initial[field.name] = field.defaultValue ?? '';
    });
    return initial;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData as T);
  };

  const handleChange = (name: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className={className}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.map((field) => (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>

            {field.type === 'text' && (
              <Input
                id={field.name}
                type="text"
                placeholder={field.placeholder}
                value={(formData[field.name] as string) || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
                maxLength={field.maxLength}
                disabled={isGenerating}
              />
            )}

            {field.type === 'textarea' && (
              <Textarea
                id={field.name}
                placeholder={field.placeholder}
                value={(formData[field.name] as string) || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                required={field.required}
                maxLength={field.maxLength}
                disabled={isGenerating}
                rows={4}
              />
            )}

            {field.type === 'select' && field.options && (
              <Select
                value={(formData[field.name] as string) || ''}
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
                  checked={(formData[field.name] as boolean) || false}
                  onCheckedChange={(checked) => handleChange(field.name, checked)}
                  disabled={isGenerating}
                />
                <label
                  htmlFor={field.name}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {field.label}
                </label>
              </div>
            )}

            {field.type === 'number' && (
              <Input
                id={field.name}
                type="number"
                placeholder={field.placeholder}
                value={(formData[field.name] as number) || ''}
                onChange={(e) => handleChange(field.name, Number(e.target.value))}
                required={field.required}
                min={field.min}
                max={field.max}
                disabled={isGenerating}
              />
            )}

            {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
          </div>
        ))}

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
      </form>
    </div>
  );
}
