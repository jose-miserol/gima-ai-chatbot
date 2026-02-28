import { google } from '@ai-sdk/google';
import { generateText, type LanguageModel } from 'ai';

import { MASTER_VOICE_PROMPT } from '@/app/config/prompts/voice-master-prompt';
import { BaseAIService } from '@/app/lib/ai/base-ai-service';
import {
  VoiceCommandSchema,
  type VoiceCommand,
  type VoiceParserOptions,
} from '@/app/types/voice-commands';

/**
 *
 */
export class VoiceCommandParserService extends BaseAIService {
  private static instance: VoiceCommandParserService;
  private model: LanguageModel;

  private constructor() {
    super({
      serviceName: 'VoiceCommandParser',
    });
    this.model = google('gemini-2.5-flash-lite');
  }

  /**
   *
   */
  public static getInstance(): VoiceCommandParserService {
    if (!VoiceCommandParserService.instance) {
      VoiceCommandParserService.instance = new VoiceCommandParserService();
    }
    return VoiceCommandParserService.instance;
  }

  /**
   * Parsea texto libre a comando estructurado
   * @param transcript
   * @param options
   */
  public async parseCommand(
    transcript: string,
    options?: VoiceParserOptions
  ): Promise<{ success: boolean; command?: VoiceCommand; error?: string }> {
    if (!transcript || transcript.trim().length < 2) {
      return { success: false, error: 'Transcripción demasiado corta' };
    }

    const minConfidence = options?.minConfidence ?? 0.7;
    const contextPrompt = options?.context ? `\nCONTEXTO ACTUAL APP: ${options.context}` : '';

    try {
      this.deps.logger?.info('Parsing voice command', { length: transcript.length });

      const result = await generateText({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: MASTER_VOICE_PROMPT + contextPrompt,
          },
          {
            role: 'user',
            content: transcript,
          },
        ],
        temperature: 0,
      });

      // Parse JSON response
      const cleanJson = result.text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (e) {
        this.deps.logger?.warn('Invalid JSON from AI', { response: result.text.slice(0, 100) });
        return { success: false, error: 'Error interno de parsing (JSON)' };
      }

      // Validate against Zod Schema
      const validation = VoiceCommandSchema.safeParse(parsed);

      if (!validation.success) {
        const errors = validation.error.issues.map((i) => `${i.path}: ${i.message}`).join(', ');
        this.deps.logger?.warn('Schema validation failed', { errors });
        return { success: false, error: `Comando no reconocido: ${errors}` };
      }

      const command = validation.data;

      // Check confidence
      if (command.confidence < minConfidence) {
        this.deps.logger?.info('Confidence check failed', {
          got: command.confidence,
          required: minConfidence,
        });
        return {
          success: false,
          error: 'No entendí el comando con suficiente claridad.',
          command, // Return command anyway for potential "Did you mean?" UI logic
        };
      }

      this.deps.logger?.info('Command parsed successfully', {
        type: command.type,
        action: command.action,
      });

      return { success: true, command };
    } catch (error) {
      this.deps.logger?.error('Error in parseCommand', error as Error);
      return { success: false, error: 'Error al procesar el comando' };
    }
  }
}
