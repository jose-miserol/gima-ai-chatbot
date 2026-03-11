/**
 * ChatMessage — Mensaje individual del chat con Generative UI
 *
 * Renderiza mensajes del usuario y asistente iterando sobre `message.parts`:
 * - `text` → Texto con markdown
 * - `image` → Imágenes adjuntas
 * - `tool-consultar_*` → Tablas de datos (DataResultCard)
 * - `tool-generar_checklist` → ChecklistResultCard
 * - `tool-generar_resumen_actividad` → SummaryResultCard
 * - `tool-crear_orden_trabajo` → OrderApprovalCard (client-side, input-available state)
 *
 * Usa el patrón de typed tool parts del AI SDK v5 donde cada tool
 * genera partes con type = `tool-<toolName>` y state = input-streaming | input-available | output-available | output-error
 */

import { CopyIcon, RefreshCcwIcon, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
  MessageAttachments,
  MessageAttachment,
} from '@/app/components/ai-elements/message';

import {
  ToolLoadingCard,
  ToolErrorCard,
  DataResultCard,
  OrderApprovalCard,
} from './tool-result-cards';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ChecklistResultCard = dynamic(
  () => import('./cards/checklist-result-card'),
  {
    loading: () => <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin inline-block mr-2" /> Cargando componente...</div>,
  }
);

const SummaryResultCard = dynamic(
  () => import('./cards/summary-result-card'),
  {
    loading: () => <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin inline-block mr-2" /> Cargando componente...</div>,
  }
);
import type { ChatMessageProps } from './types';

// ===========================================
// Types
// ===========================================

interface TextPart {
  type: 'text';
  text: string;
}

interface ImagePart {
  type: 'image';
  imageUrl: string;
  mimeType?: string;
}

// Tool part with generic structure from AI SDK v5
interface ToolPart {
  type: string; // `tool-<toolName>`
  toolCallId: string;
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'approval-requested';
  input?: any;
  output?: any;
  errorText?: string;
  approval?: { id: string };
}

// ===========================================
// Helpers
// ===========================================

function getTextContent(parts: unknown[] | undefined): string {
  if (!parts || parts.length === 0) return '';
  const textParts = parts.filter((part: any): part is TextPart => part?.type === 'text');
  let text = textParts.map((part) => part.text).join('\n\n');

  // Limpiar artefactos de llamadas a herramientas (ej. Llama 3 "función=consultar_mantenimientos>{...}")
  // que a veces se filtran como texto antes de ser parseados correctamente.
  text = text.replace(/(?:función|function)=[\w_]+>\{.*?\}/gi, '');
  text = text.replace(/<tool_call>.*?<\/tool_call>/gs, '');

  return text.trim();
}

function isToolPart(part: any): part is ToolPart {
  return typeof part?.type === 'string' && part.type.startsWith('tool-');
}

/** Tool names that render as data tables */
const DATA_TABLE_TOOLS = new Set([
  'tool-consultar_activos',
  'tool-consultar_activos_por_categoria',
  'tool-consultar_mantenimientos',
  'tool-consultar_calendario',
  'tool-consultar_reportes',
  'tool-consultar_inventario',
  'tool-consultar_proveedores',
]);

// ===========================================
// Collapsible LLM Text (when tool results present)
// ===========================================

/**
 * Renders the LLM's text response in a collapsible section.
 * Used when tool results are present to avoid redundant text above tables.
 * Collapsed by default — the user can expand if they want to read the LLM commentary.
 */
function CollapsibleLLMText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
      >
        {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        {expanded ? 'Ocultar comentario del asistente' : 'Ver comentario del asistente'}
      </button>
      {expanded && (
        <MessageContent>
          <MessageResponse>{text}</MessageResponse>
        </MessageContent>
      )}
    </div>
  );
}

// ===========================================
// Component
// ===========================================

/**
 * ChatMessage — Mensaje individual con Generative UI
 *
 * Renderiza mensajes con:
 * - Contenido de texto (markdown)
 * - Imágenes adjuntas
 * - Resultados de tools como componentes React
 * - Acciones (solo para mensajes del asistente)
 */
export function ChatMessage({
  message,
  onRegenerate,
  onCopy,
  onToolApproval,
}: ChatMessageProps & {
  onToolApproval?: (approvalId: string, approved: boolean, input?: any) => void;
}) {
  const parts = (message.parts as unknown[]) || [];
  let textContent = getTextContent(parts);

  const isGroqSchemaError = textContent.includes('Failed to call a function') || textContent.includes('failed_generation');
  const isQuotaError = textContent.includes('quota') || textContent.includes('Quota') || textContent.includes('Rate limit reached') || textContent.includes('limit: 0');

  const imageParts = parts.filter(
    (part: any): part is ImagePart => part?.type === 'image'
  );

  const toolParts = parts.filter(isToolPart);

  // Si no hay contenido, no renderizar
  if (!textContent && imageParts.length === 0 && toolParts.length === 0) {
    return null;
  }

  return (
    <Message key={message.id} from={message.role}>
      {/* Imágenes */}
      {imageParts.length > 0 && (
        <MessageAttachments>
          {imageParts.map((part, i) => (
            <MessageAttachment
              key={`${message.id}-img-${i}`}
              data={{
                type: 'file',
                url: part.imageUrl,
                mediaType: part.mimeType || 'image/jpeg',
                filename: `image-${i + 1}.jpg`,
              }}
            />
          ))}
        </MessageAttachments>
      )}

      {/* Texto — collapsible when tool results are present */}
      {isGroqSchemaError || isQuotaError ? (
        <ToolErrorCard error={textContent} />
      ) : textContent && toolParts.length > 0 ? (
        <CollapsibleLLMText text={textContent} />
      ) : textContent ? (
        <MessageContent>
          <MessageResponse>{textContent}</MessageResponse>
        </MessageContent>
      ) : null}

      {/* Tool Results — Generative UI */}
      {toolParts.map((part) => {
        const key = `${message.id}-${part.toolCallId}`;

        // Loading states
        if (part.state === 'input-streaming' || part.state === 'input-available') {
          return <ToolLoadingCard key={key} toolName={part.type} />;
        }

        // Error state — show friendly gray message, log raw error to console
        if (part.state === 'output-error') {
          return (
            <ToolErrorCard
              key={key}
              error={part.errorText || 'Error desconocido'}
            />
          );
        }

        // Approval request (crear_orden_trabajo)
        if (part.type === 'tool-crear_orden_trabajo' && part.state === 'approval-requested') {
          return (
            <OrderApprovalCard
              key={key}
              input={part.input || {}}
              onApprove={() => onToolApproval?.(part.approval?.id || '', true, part.input)}
              onDeny={() => onToolApproval?.(part.approval?.id || '', false, part.input)}
            />
          );
        }

        // Output available
        if (part.state === 'output-available') {
          const output = part.output;

          // Data table tools
          if (DATA_TABLE_TOOLS.has(part.type) && output?.success && output?.data) {
            return (
              <DataResultCard
                key={key}
                data={output.data}
                toolName={part.type}
                summary={output.summary}
              />
            );
          }

          // Checklist
          if (part.type === 'tool-generar_checklist' && output?.success && output?.checklist) {
            return (
              <ChecklistResultCard
                key={key}
                checklist={output.checklist}
                cached={output.cached}
              />
            );
          }

          // Summary
          if (part.type === 'tool-generar_resumen_actividad' && output?.success && output?.summary) {
            return (
              <SummaryResultCard
                key={key}
                summary={output.summary}
                cached={output.cached}
              />
            );
          }

          // Error from tool
          if (output?.success === false) {
            return (
              <ToolErrorCard
                key={key}
                error={output.error || 'Error en la herramienta'}
                suggestion={output.suggestion}
              />
            );
          }

          // Fallback: show raw output as text
          return (
            <div key={key} className="p-3 rounded-lg bg-muted/30 border border-border my-2">
              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          );
        }

        return null;
      })}

      {/* Acciones del asistente */}
      {message.role === 'assistant' && textContent && (
        <MessageActions>
          {!textContent.includes('Análisis Visual (IA)') && !textContent.includes('**Análisis de Documento**') && (
            <MessageAction onClick={onRegenerate} label="Reintentar">
              <RefreshCcwIcon className="size-3" />
            </MessageAction>
          )}
          <MessageAction onClick={() => onCopy(textContent)} label="Copiar">
            <CopyIcon className="size-3" />
          </MessageAction>
        </MessageActions>
      )}
    </Message>
  );
}
