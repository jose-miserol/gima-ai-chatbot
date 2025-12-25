/**
 * Tests for Voice Command Types and Schemas
 *
 * Verifica validación Zod de comandos de voz y funciones helper:
 * - Schemas para comandos, actions, prioridades
 * - validateVoiceCommand helper
 * - requiresConfirmation logic
 * - formatCommandSummary formatting
 */

import { describe, it, expect } from 'vitest';
import {
  VoiceCommandAction,
  WorkOrderPriority,
  VoiceWorkOrderCommandSchema,
  VoiceCommandResultSchema,
  VoiceParserOptionsSchema,
  CommandExecutionStatusSchema,
  validateVoiceCommand,
  createEmptyCommand,
  requiresConfirmation,
  formatCommandSummary,
  type VoiceWorkOrderCommand,
} from '../voice-commands';

describe('VoiceCommandAction Schema', () => {
  it('should accept valid actions', () => {
    const validActions = [
      'create_work_order',
      'check_status',
      'list_pending',
      'update_priority',
      'assign_technician',
    ];

    validActions.forEach((action) => {
      const result = VoiceCommandAction.safeParse(action);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid actions', () => {
    const invalidActions = ['delete_order', 'unknown', '', 123];

    invalidActions.forEach((action) => {
      const result = VoiceCommandAction.safeParse(action);
      expect(result.success).toBe(false);
    });
  });
});

describe('WorkOrderPriority Schema', () => {
  it('should accept valid priorities', () => {
    const validPriorities = ['urgent', 'normal', 'low'];

    validPriorities.forEach((priority) => {
      const result = WorkOrderPriority.safeParse(priority);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid priorities', () => {
    const result = WorkOrderPriority.safeParse('critical');
    expect(result.success).toBe(false);
  });
});

describe('VoiceWorkOrderCommandSchema', () => {
  it('should validate a complete valid command', () => {
    const validCommand = {
      action: 'create_work_order',
      equipment: 'UMA-001',
      location: 'Sector 3',
      priority: 'urgent',
      description: 'El compresor está fallando',
      assignee: 'Juan Pérez',
      confidence: 0.95,
      rawTranscript: 'Crear orden urgente para la UMA del sector 3',
      type: 'work_order',
    };

    const result = VoiceWorkOrderCommandSchema.safeParse(validCommand);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('create_work_order');
      expect(result.data.priority).toBe('urgent');
    }
  });

  it('should validate minimal command (only required fields)', () => {
    const minimalCommand = {
      action: 'list_pending',
      confidence: 0.9,
      rawTranscript: 'Listar órdenes pendientes',
      type: 'work_order',
    };

    const result = VoiceWorkOrderCommandSchema.safeParse(minimalCommand);
    expect(result.success).toBe(true);
  });

  it('should reject command with missing required fields', () => {
    const incomplete = {
      action: 'create_work_order',
      // Missing confidence and rawTranscript
    };

    const result = VoiceWorkOrderCommandSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('should reject confidence outside 0-1 range', () => {
    const invalidConfidence = {
      action: 'list_pending',
      confidence: 1.5, // Invalid
      rawTranscript: 'Test',
      type: 'work_order',
    };

    const result = VoiceWorkOrderCommandSchema.safeParse(invalidConfidence);
    expect(result.success).toBe(false);
  });

  it('should reject empty rawTranscript', () => {
    const emptyTranscript = {
      action: 'list_pending',
      confidence: 0.9,
      rawTranscript: '', // Invalid - min 1 char
      type: 'work_order',
    };

    const result = VoiceWorkOrderCommandSchema.safeParse(emptyTranscript);
    expect(result.success).toBe(false);
  });

  it('should enforce equipment min/max length', () => {
    const tooShort = {
      action: 'create_work_order',
      equipment: 'A', // Too short (min 2)
      confidence: 0.9,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    const result = VoiceWorkOrderCommandSchema.safeParse(tooShort);
    expect(result.success).toBe(false);
  });
});

describe('VoiceCommandResultSchema (Discriminated Union)', () => {
  it('should validate success result', () => {
    const successResult = {
      success: true,
      command: {
        action: 'create_work_order',
        confidence: 0.9,
        rawTranscript: 'Test command',
        type: 'work_order',
      },
    };

    const result = VoiceCommandResultSchema.safeParse(successResult);
    expect(result.success).toBe(true);
  });

  it('should validate error result', () => {
    const errorResult = {
      success: false,
      error: 'Comando no reconocido',
      code: 'PARSE_ERROR',
      recoverable: true,
    };

    const result = VoiceCommandResultSchema.safeParse(errorResult);
    expect(result.success).toBe(true);
  });
});

describe('VoiceParserOptionsSchema', () => {
  it('should apply default values', () => {
    const result = VoiceParserOptionsSchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.language).toBe('es-ES');
      expect(result.data.minConfidence).toBe(0.7);
    }
  });

  it('should accept custom options', () => {
    const options = {
      language: 'en-US',
      minConfidence: 0.85,
      context: 'Mantenimiento preventivo',
    };

    const result = VoiceParserOptionsSchema.safeParse(options);
    expect(result.success).toBe(true);
  });
});

describe('CommandExecutionStatusSchema', () => {
  it('should accept valid statuses', () => {
    const statuses = ['pending', 'executing', 'completed', 'failed', 'cancelled'];

    statuses.forEach((status) => {
      const result = CommandExecutionStatusSchema.safeParse(status);
      expect(result.success).toBe(true);
    });
  });
});

// === Helper Functions Tests ===

describe('validateVoiceCommand', () => {
  it('should return success for valid command', () => {
    const validData = {
      action: 'create_work_order',
      confidence: 0.9,
      rawTranscript: 'Crear orden de trabajo',
      type: 'work_order',
    };

    const result = validateVoiceCommand(validData);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.errors).toBeUndefined();
  });

  it('should return errors for invalid command', () => {
    const invalidData = {
      action: 'invalid_action',
      confidence: 2.0, // Invalid
      rawTranscript: '',
    };

    const result = validateVoiceCommand(invalidData);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it('should handle null/undefined input', () => {
    const result = validateVoiceCommand(null);
    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('createEmptyCommand', () => {
  it('should create command with default values', () => {
    const empty = createEmptyCommand();

    expect(empty.action).toBe('create_work_order');
    expect(empty.confidence).toBe(0);
    expect(empty.rawTranscript).toBe('');
  });
});

describe('requiresConfirmation', () => {
  it('should require confirmation for urgent priority', () => {
    const urgentCommand: VoiceWorkOrderCommand = {
      action: 'create_work_order',
      priority: 'urgent',
      confidence: 0.95,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    expect(requiresConfirmation(urgentCommand)).toBe(true);
  });

  it('should require confirmation for assign_technician action', () => {
    const assignCommand: VoiceWorkOrderCommand = {
      action: 'assign_technician',
      assignee: 'Juan',
      confidence: 0.95,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    expect(requiresConfirmation(assignCommand)).toBe(true);
  });

  it('should require confirmation for low confidence', () => {
    const lowConfidence: VoiceWorkOrderCommand = {
      action: 'list_pending',
      confidence: 0.75, // Below 0.85 threshold
      rawTranscript: 'Test',
      type: 'work_order',
    };

    expect(requiresConfirmation(lowConfidence)).toBe(true);
  });

  it('should NOT require confirmation for high confidence normal command', () => {
    const normalCommand: VoiceWorkOrderCommand = {
      action: 'list_pending',
      priority: 'normal',
      confidence: 0.95,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    expect(requiresConfirmation(normalCommand)).toBe(false);
  });
});

describe('formatCommandSummary', () => {
  it('should format create_work_order action', () => {
    const command: VoiceWorkOrderCommand = {
      action: 'create_work_order',
      equipment: 'UMA-001',
      location: 'Sector 3',
      priority: 'urgent',
      confidence: 0.9,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    const summary = formatCommandSummary(command);

    expect(summary).toContain('Crear orden de trabajo');
    expect(summary).toContain('UMA-001');
    expect(summary).toContain('Sector 3');
    expect(summary).toContain('urgent');
  });

  it('should format list_pending action', () => {
    const command: VoiceWorkOrderCommand = {
      action: 'list_pending',
      confidence: 0.95,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    const summary = formatCommandSummary(command);
    expect(summary).toBe('Listar órdenes pendientes');
  });

  it('should format check_status action', () => {
    const command: VoiceWorkOrderCommand = {
      action: 'check_status',
      equipment: 'BCA-002',
      confidence: 0.9,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    const summary = formatCommandSummary(command);
    expect(summary).toContain('Verificar estado');
    expect(summary).toContain('BCA-002');
  });

  it('should format update_priority action', () => {
    const command: VoiceWorkOrderCommand = {
      action: 'update_priority',
      priority: 'low',
      confidence: 0.9,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    const summary = formatCommandSummary(command);
    expect(summary).toContain('Actualizar prioridad');
    expect(summary).toContain('low');
  });

  it('should format assign_technician action', () => {
    const command: VoiceWorkOrderCommand = {
      action: 'assign_technician',
      assignee: 'Carlos',
      confidence: 0.9,
      rawTranscript: 'Test',
      type: 'work_order',
    };

    const summary = formatCommandSummary(command);
    expect(summary).toContain('Asignar técnico');
  });
});
