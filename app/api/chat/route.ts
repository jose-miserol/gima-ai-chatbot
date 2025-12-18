import { createGroq } from '@ai-sdk/groq';
import { streamText, UIMessage, convertToModelMessages } from 'ai';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize GROQ
const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: Request) {
  try {
    const {
      messages,
      model = 'llama-3.3-70b-versatile',
    }: {
      messages: UIMessage[];
      model?: string;
    } = await req.json();

    // System prompt específico para GIMA
    const systemPrompt = `Eres un asistente experto en gestión de mantenimiento y activos para la Universidad Nacional Experimental de Guayana (UNEG).

Tu objetivo es ayudar a técnicos, ingenieros y personal de mantenimiento con:
- Consultas sobre equipos y su estado
- Procedimientos de mantenimiento preventivo y correctivo
- Interpretación de manuales técnicos
- Diagnóstico de fallas comunes
- Recomendaciones de repuestos

Directrices:
1. Sé preciso y técnico, pero claro
2. Si no estás seguro, admítelo y sugiere consultar un manual
3. Prioriza la seguridad en todas las recomendaciones
4. Usa terminología técnica apropiada
5. Proporciona pasos claros y numerados cuando sea necesario

Contexto: La UNEG está digitalizando su sistema de mantenimiento. Actualmente muchos procesos son manuales.`;

    const result = streamText({
      model: groq(model),
      messages: convertToModelMessages(messages),
      system: systemPrompt,
      maxTokens: 2048,
      temperature: 0.7,
    });

    return result.toUIMessageStreamResponse({
      sendSources: false,
      sendReasoning: false,
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