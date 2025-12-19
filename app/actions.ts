'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

export async function transcribeAudio(audioDataUrl: string): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    // 1. LIMPIEZA CRÍTICA: Eliminar el prefijo "data:audio/webm;base64,"
    const base64Content = audioDataUrl.split(';base64,').pop() || '';

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'), 
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: 'Transcribe este audio técnico exactamente.' 
            },
            {
              type: 'file',
              data: base64Content, // <--- Enviamos SOLO el base64 limpio
              mediaType: 'audio/webm', 
            },
          ],
        },
      ],
    });

    return { text: result.text, success: true };
  } catch (error: any) {
    console.error('Error transcripción Gemini:', {
      message: error.message,
      name: error.name,
      cause: error.cause,
      stack: error.stack,
    });
    return { 
      text: '', 
      success: false, 
      error: error.message 
    };
  }
}