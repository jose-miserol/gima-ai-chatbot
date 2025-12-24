import { createGroq } from '@ai-sdk/groq';
import { streamText, type LanguageModel } from 'ai';
import { SYSTEM_PROMPT } from '@/app/config';
import { env } from '@/app/config/env';
import { chatRateLimiter } from '@/app/lib/rate-limiter';
import { logger } from '@/app/lib/logger';
import { chatRequestSchema } from '@/app/lib/schemas';
import { sanitizeForModel } from '@/app/components/features/chat/utils';
import { ERROR_MESSAGES } from '@/app/constants/messages';

// Define dependencies for injection
export interface ChatServiceDependencies {
  logger: typeof logger;
  rateLimiter: typeof chatRateLimiter;
  modelProvider: (modelId: string) => LanguageModel;
}

export class ChatService {
  private deps: ChatServiceDependencies;

  constructor(dependencies: Partial<ChatServiceDependencies> = {}) {
    this.deps = {
      logger: dependencies.logger || logger,
      rateLimiter: dependencies.rateLimiter || chatRateLimiter,
      modelProvider: dependencies.modelProvider || createGroq({ apiKey: env.GROQ_API_KEY }),
    };
  }

  /**
   * Process a chat message request
   * @param rawBody - The raw JSON body from the request
   * @param clientIP - The client's IP address for rate limiting
   * @returns The AI stream result
   */
  async processMessage(rawBody: unknown, clientIP: string | null) {
    // 1. Rate Limiting
    if (clientIP && !this.deps.rateLimiter.checkLimit(clientIP)) {
      const retryAfter = Math.ceil(this.deps.rateLimiter.getRetryAfter(clientIP) / 1000);
      throw new RateLimitError(retryAfter);
    }

    // 2. Validation
    // console.log('RawBody:', JSON.stringify(rawBody, null, 2));
    const parseResult = chatRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.issues);
    }

    const { messages: rawMessages, model } = parseResult.data;

    // 3. Sanitization
    const messages = sanitizeForModel(rawMessages);

    // 4. AI Generation
    try {
      const result = streamText({
        model: this.deps.modelProvider(model),
        messages,
        system: SYSTEM_PROMPT,
      });

      return result;
    } catch (error) {
      this.deps.logger.error(
        'Error generando respuesta AI',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'ChatService', action: 'processMessage' }
      );
      throw error;
    }
  }
}

// Custom Errors
export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super(ERROR_MESSAGES.RATE_LIMIT);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends Error {
  constructor(public details: unknown) {
    super(ERROR_MESSAGES.INVALID_REQUEST);
    this.name = 'ValidationError';
  }
}
