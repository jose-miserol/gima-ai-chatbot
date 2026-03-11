/**
 * Chat Utilities - Funciones de utilidad para el procesamiento de mensajes
 *
 * Este módulo contiene la lógica de sanitización y transformación de mensajes.
 * Separado del API route para mejor testabilidad y reutilización.
 *
 * Incluye la estrategia de "Resumen de Contexto" para inyectar resúmenes
 * ligeros de tool results en el historial del LLM, permitiendo que la IA
 * recuerde qué datos mostró en turnos anteriores sin enviar JSON completo.
 */

import type { Message } from '@/app/lib/schemas/chat';

import type { MessagePart } from './types/message.types';
import type { UIMessage } from 'ai';

/**
 * Extrae el contenido de texto de un mensaje
 *
 * Maneja los diferentes formatos que puede tener el contenido:
 * - String directo
 * - Objeto con propiedad `text`
 * - Objeto con array de `parts` que contiene partes de texto
 * @param content - El contenido del mensaje en cualquier formato válido
 * @param parts - Array opcional de partes del mensaje
 * @returns El texto extraído o string vacío si no se encuentra
 */
function extractTextContent(
  content: string | { parts?: MessagePart[]; text?: string } | undefined,
  parts?: MessagePart[]
): string {
  // Caso 1: Content es un string directo
  if (typeof content === 'string') {
    return content;
  }

  // Caso 2: Content es un objeto con propiedad text
  if (content && typeof content === 'object' && 'text' in content && content.text) {
    return content.text;
  }

  // Caso 3: Content es un objeto con parts
  if (content && typeof content === 'object' && 'parts' in content && content.parts) {
    const textPart = content.parts.find(
      (p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text'
    );
    if (textPart) {
      return textPart.text;
    }
  }

  // Caso 4: Hay parts en el nivel del mensaje
  if (parts && parts.length > 0) {
    const textPart = parts.find(
      (p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text'
    );
    if (textPart) {
      return textPart.text;
    }
  }

  // Fallback: string vacío
  return '';
}

// ===========================================
// Tool Context Summary (Resumen de Contexto)
// ===========================================

/** Máximo de items de ejemplo a incluir en el resumen */
const MAX_SUMMARY_ITEMS = 4;

/**
 * Nombres legibles para cada toolName del AI SDK v5
 */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  consultar_activos: 'activos',
  consultar_mantenimientos: 'mantenimientos',
  consultar_calendario: 'entradas del calendario',
  consultar_reportes: 'reportes',
  consultar_inventario: 'repuestos',
  consultar_proveedores: 'proveedores',
  generar_checklist: 'checklist',
  generar_resumen_actividad: 'resumen',
  crear_orden_trabajo: 'orden de trabajo',
};

/**
 * Interfaz para tool-invocation parts del AI SDK v5.
 * En AI SDK v5, las tool parts usan:
 *   type: 'tool-invocation'
 *   toolName: 'consultar_activos'
 *   state: 'call' | 'partial-call' | 'result'
 *   args: { ... }       (input del tool)
 *   result: { ... }     (output del tool, solo cuando state === 'result')
 */
interface ToolInvocationPart {
  type: 'tool-invocation';
  toolCallId?: string;
  toolName?: string;
  state?: string;
  args?: Record<string, unknown>;
  result?: {
    success?: boolean;
    data?: {
      items?: Record<string, unknown>[];
      pagination?: { total?: number; page?: number; lastPage?: number };
    };
    summary?: string | { title?: string; executive?: string };
    checklist?: { title?: string; items?: { description?: string }[] };
    cached?: boolean;
    error?: string;
  };
}

/**
 * Genera un resumen corto de un item de datos para inyectar como contexto.
 * Prioriza campos legibles: nombre > descripcion > codigo > id
 */
function summarizeDataItem(item: Record<string, unknown>): string {
  const name = item.nombre || item.descripcion || item.codigo || item.id;
  const estado = item.estado ? ` (${item.estado})` : '';
  const tipo = item.tipo ? ` [${item.tipo}]` : '';
  const stock = item.stock !== undefined ? ` stock:${item.stock}` : '';
  const stockMin = item.stock_minimo !== undefined ? `/${item.stock_minimo}` : '';
  return `${String(name || 'item')}${tipo}${estado}${stock}${stockMin}`;
}

/**
 * Genera un resumen compacto de los resultados de una tool invocation.
 * Diseñado para inyectar como contexto ligero en el historial del LLM
 * (~80-120 tokens vs ~2,000 del JSON completo).
 *
 * @param toolPart - Tool invocation part del AI SDK v5
 * @returns Resumen de texto o null si no aplica
 */
function summarizeToolOutput(toolPart: ToolInvocationPart): string | null {
  const toolName = toolPart.toolName;
  if (!toolName) return null;

  const displayName = TOOL_DISPLAY_NAMES[toolName];
  if (!displayName) return null;

  const result = toolPart.result;
  if (!result || !result.success) return null;

  // --- Data tables (activos, inventario, mantenimientos, etc.) ---
  if (result.data?.items && result.data.pagination) {
    const { items, pagination } = result.data;
    const total = pagination.total ?? items.length;

    if (items.length === 0) {
      return `[Contexto: Se buscaron ${displayName} pero no se encontraron resultados.]`;
    }

    const examples = items.slice(0, MAX_SUMMARY_ITEMS).map(summarizeDataItem).join(', ');

    const moreText = total > MAX_SUMMARY_ITEMS ? ` y ${total - MAX_SUMMARY_ITEMS} más` : '';

    // Incluir filtros usados si los hay
    const filters: string[] = [];
    const args = toolPart.args;
    if (args) {
      if (args.estado) filters.push(`estado=${args.estado}`);
      if (args.tipo) filters.push(`tipo=${args.tipo}`);
      if (args.bajo_stock) filters.push('bajo_stock=true');
      if (args.buscar) filters.push(`búsqueda="${args.buscar}"`);
      if (args.prioridad) filters.push(`prioridad=${args.prioridad}`);
    }
    const filterText = filters.length > 0 ? ` (filtros: ${filters.join(', ')})` : '';

    return `[Contexto: Se mostraron ${total} ${displayName}${filterText}. Incluyen: ${examples}${moreText}.]`;
  }

  // --- Checklist generado ---
  if (result.checklist) {
    const { title, items } = result.checklist;
    const count = items?.length ?? 0;
    return `[Contexto: Se generó checklist "${title || 'Sin título'}" con ${count} items.]`;
  }

  // --- Resumen de actividad ---
  if (result.summary && typeof result.summary === 'object') {
    const { title } = result.summary;
    return `[Contexto: Se generó resumen de actividad "${title || 'Sin título'}".]`;
  }

  return null;
}

/**
 * Extrae resúmenes de contexto de las tool parts crudas de un mensaje.
 * Usa el formato de AI SDK v5 (type: 'tool-invocation', state: 'result').
 *
 * Esta función es defensiva: nunca lanza excepciones.
 *
 * @param rawParts - Array de parts crudas del mensaje
 * @returns String con todos los resúmenes concatenados, o vacío si no hay tools
 */
export function summarizeToolParts(rawParts: unknown[]): string {
  try {
    if (!rawParts || rawParts.length === 0) return '';

    const summaries: string[] = [];

    for (const part of rawParts) {
      // Verificar que sea un object con la estructura esperada
      if (typeof part !== 'object' || part === null) continue;

      const p = part as Record<string, unknown>;

      // AI SDK v5 usa type: 'tool-invocation' con state: 'result'
      if (p.type === 'tool-invocation' && p.state === 'result') {
        const summary = summarizeToolOutput(part as ToolInvocationPart);
        if (summary) {
          summaries.push(summary);
        }
      }
    }

    return summaries.length > 0 ? '\n\n' + summaries.join('\n') : '';
  } catch {
    // Nunca romper el chat por un error de resumen
    return '';
  }
}

// ===========================================
// Message Sanitization
// ===========================================

/**
 * Sanitiza un array de mensajes para convertirlos al formato UIMessage
 *
 * Esta función:
 * - Asegura que content siempre sea un string
 * - Extrae texto de objetos con parts si es necesario
 * - Normaliza el campo createdAt a Date o undefined
 * - Preserva las parts originales para futuro soporte multimodal
 * @param rawMessages - Mensajes validados por Zod pero potencialmente con contenido mixto
 * @returns Array de mensajes sanitizados compatibles con UIMessage
 */
export function sanitizeMessages(rawMessages: Message[]): UIMessage[] {
  return rawMessages.map((msg) => {
    const textContent = extractTextContent(msg.content, msg.parts);

    return {
      id: msg.id || crypto.randomUUID(),
      role: msg.role,
      content: textContent,
      parts: msg.parts || [],
      createdAt: msg.createdAt,
    } as UIMessage;
  });
}

/**
 * Tipo para mensajes compatibles con el modelo AI
 * Formato simple que GROQ y otros providers aceptan
 */
export interface CoreMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Interfaz para un mensaje crudo del cliente (antes del parsing de Zod).
 * Usado para extraer tool parts que Zod descarta con .catch(undefined).
 */
export interface RawClientMessage {
  role?: string;
  content?: unknown;
  parts?: unknown[];
}

/**
 * Sanitiza mensajes para uso directo con streamText/generateText
 *
 * Retorna un array simple de { role, content } que todos los providers aceptan.
 * Filtra mensajes vacíos automáticamente.
 *
 * Si se proporcionan rawMessages (body crudo antes de Zod), inyecta resúmenes
 * de contexto de tools en los mensajes del asistente para que la IA recuerde
 * qué datos mostró en turnos anteriores (~80 tokens vs ~2,000 del JSON).
 *
 * @param parsedMessages - Mensajes parseados por Zod
 * @param rawMessages - Mensajes crudos del body (opcional, para contexto de tools)
 * @returns Array de mensajes en formato CoreMessage
 */
export function sanitizeForModel(
  parsedMessages: Message[],
  rawMessages?: RawClientMessage[]
): CoreMessage[] {
  return parsedMessages
    .map((msg, index) => {
      let content = extractTextContent(msg.content, msg.parts);

      // NUEVO: Detectar si es el último mensaje del array
      const isLastMessage = index === parsedMessages.length - 1;

      // NUEVO: Marcar los mensajes pasados del usuario como resueltos
      if (msg.role === 'user' && !isLastMessage) {
        content = `[CONSULTA ANTERIOR YA RESUELTA]: ${content}`;
      }

      // Inyectar resumen de tools en mensajes del asistente
      if (msg.role === 'assistant' && rawMessages && rawMessages[index]) {
        try {
          const rawParts = rawMessages[index].parts;
          if (rawParts && Array.isArray(rawParts)) {
            content += summarizeToolParts(rawParts);
          }
        } catch {
          // Silently ignore
        }
      }

      return { role: msg.role, content };
    })
    .filter((msg) => msg.content.trim().length > 0);
}
/**
 * Valida que un mensaje tenga contenido no vacío
 * @param message - Mensaje a validar
 * @returns true si el mensaje tiene contenido válido
 */
export function hasValidContent(message: UIMessage): boolean {
  // UIMessage tiene parts, necesitamos extraer el contenido de texto
  const textPart = message.parts?.find(
    (p): p is { type: 'text'; text: string } =>
      typeof p === 'object' && p !== null && 'type' in p && p.type === 'text'
  );
  const content = textPart?.text || '';
  return content.trim().length > 0;
}

/**
 * Filtra mensajes vacíos de un array
 * @param messages - Array de mensajes
 * @returns Array con solo mensajes que tienen contenido
 */
export function filterEmptyMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter(hasValidContent);
}
