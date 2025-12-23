/**
 * Pruebas de Integración para Flujo de Comandos de Voz
 *
 * Tests del flujo lógico de comandos de voz sin dependencias de React
 */

import { describe, it, expect } from 'vitest';
import {
  validateVoiceCommand,
  requiresConfirmation,
  formatCommandSummary,
} from '@/app/types/voice-commands';
import type { VoiceWorkOrderCommand } from '@/app/types/voice-commands';

describe('Voice Command Flow Integration', () => {
  describe('Command Validation Flow', () => {
    it('should validate a complete command', () => {
      const command = {
        action: 'create_work_order',
        equipment: 'UMA-001',
        location: 'Sector 1',
        priority: 'urgent',
        confidence: 0.95,
        rawTranscript: 'test',
      };

      const result = validateVoiceCommand(command);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should reject invalid action', () => {
      const command = {
        action: 'invalid_action',
        confidence: 0.9,
        rawTranscript: 'test',
      };

      const result = validateVoiceCommand(command);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should reject missing required fields', () => {
      const command = {
        action: 'create_work_order',
        // Missing confidence and rawTranscript
      };

      const result = validateVoiceCommand(command);
      expect(result.success).toBe(false);
    });
  });

  describe('Command Confirmation Requirements', () => {
    it('should require confirmation for urgent priority', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'create_work_order',
        priority: 'urgent',
        confidence: 0.95,
        rawTranscript: 'test',
      };
      expect(requiresConfirmation(command)).toBe(true);
    });

    it('should require confirmation for assign_technician', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'assign_technician',
        assignee: 'Carlos',
        confidence: 0.95,
        rawTranscript: 'test',
      };
      expect(requiresConfirmation(command)).toBe(true);
    });

    it('should require confirmation for low confidence commands', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'check_status',
        confidence: 0.6, // Low confidence < 0.85
        rawTranscript: 'test',
      };
      expect(requiresConfirmation(command)).toBe(true);
    });

    it('should NOT require confirmation for list_pending with high confidence', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'list_pending',
        confidence: 0.95,
        rawTranscript: 'test',
      };
      expect(requiresConfirmation(command)).toBe(false);
    });

    it('should NOT require confirmation for check_status with high confidence', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'check_status',
        confidence: 0.9,
        rawTranscript: 'test',
      };
      expect(requiresConfirmation(command)).toBe(false);
    });

    it('should NOT require confirmation for normal priority with high confidence', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'create_work_order',
        priority: 'normal',
        confidence: 0.95,
        rawTranscript: 'test',
      };
      expect(requiresConfirmation(command)).toBe(false);
    });
  });

  describe('Command Summary Formatting', () => {
    it('should format create_work_order summary', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'create_work_order',
        equipment: 'UMA-001',
        confidence: 0.9,
        rawTranscript: 'test',
      };

      const summary = formatCommandSummary(command);
      expect(summary).toContain('Crear orden de trabajo');
    });

    it('should format list_pending summary', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'list_pending',
        confidence: 0.9,
        rawTranscript: 'test',
      };

      const summary = formatCommandSummary(command);
      expect(summary).toContain('Listar órdenes pendientes');
    });

    it('should format check_status summary with equipment', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'check_status',
        equipment: 'BCA-002',
        confidence: 0.9,
        rawTranscript: 'test',
      };

      const summary = formatCommandSummary(command);
      expect(summary).toContain('Verificar estado');
      expect(summary).toContain('BCA-002');
    });

    it('should format update_priority summary', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'update_priority',
        equipment: 'TAB-001',
        priority: 'urgent',
        confidence: 0.9,
        rawTranscript: 'test',
      };

      const summary = formatCommandSummary(command);
      expect(summary).toContain('Actualizar prioridad');
    });

    it('should format assign_technician summary', () => {
      const command: VoiceWorkOrderCommand = {
        action: 'assign_technician',
        assignee: 'Carlos Rodriguez',
        confidence: 0.9,
        rawTranscript: 'test',
      };

      const summary = formatCommandSummary(command);
      expect(summary).toContain('Asignar técnico');
    });
  });

  describe('End-to-End Flow Logic', () => {
    it('should validate then check confirmation then format', () => {
      const commandData = {
        action: 'create_work_order',
        equipment: 'UMA-001',
        location: 'Sector 3',
        priority: 'urgent',
        description: 'Falla en compresor',
        confidence: 0.95,
        rawTranscript: 'Crear orden urgente para la UMA del sector 3',
      };

      // 1. Validate
      const validationResult = validateVoiceCommand(commandData);
      expect(validationResult.success).toBe(true);

      if (validationResult.success && validationResult.data) {
        // 2. Check confirmation
        const needsConfirmation = requiresConfirmation(validationResult.data);
        expect(needsConfirmation).toBe(true); // urgent = requires confirmation

        // 3. Format summary
        const summary = formatCommandSummary(validationResult.data);
        expect(summary).toContain('Crear orden de trabajo');
        expect(summary).toContain('UMA-001');
      }
    });

    it('should handle low confidence flow', () => {
      const commandData = {
        action: 'check_status',
        equipment: 'BCA-001',
        confidence: 0.7, // Low confidence
        rawTranscript: 'verificar BCA',
      };

      const validationResult = validateVoiceCommand(commandData);
      expect(validationResult.success).toBe(true);

      if (validationResult.success && validationResult.data) {
        const needsConfirmation = requiresConfirmation(validationResult.data);
        expect(needsConfirmation).toBe(true); // low confidence = requires confirmation
      }
    });
  });
});
