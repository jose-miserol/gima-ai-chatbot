import { createGroq } from '@ai-sdk/groq';
import { streamText, UIMessage, convertToModelMessages } from 'ai';
import { SYSTEM_PROMPT, STREAM_CONFIG, DEFAULT_MODEL } from '@/app/config';

// Allow streaming responses up to 30 seconds
// Note: Must be a literal value for Next.js static analysis
export const maxDuration = 30;

// Initialize GROQ
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const {
      messages,
      model = DEFAULT_MODEL,
    }: {
      messages: UIMessage[];
      model?: string;
    } = await req.json();

    const result = streamText({
      model: groq(model),
      messages: convertToModelMessages(messages),
      system: SYSTEM_PROMPT,
    });

    return result.toUIMessageStreamResponse({
      sendSources: STREAM_CONFIG.sendSources,
      sendReasoning: STREAM_CONFIG.sendReasoning,
    });
  } catch (error) {
    console.error('Error en API de chat:', error);
    return new Response(
      JSON.stringify({ error: 'Error al procesar la solicitud' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}