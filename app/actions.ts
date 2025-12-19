'use server';

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { VOICE_PROMPT } from '@/app/config';


export async function transcribeAudio(audioDataUrl: string): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    const base64Content = audioDataUrl.includes('base64,') 
      ? audioDataUrl.split('base64,').pop() || ''
      : audioDataUrl;

    if (!base64Content) throw new Error("Audio vacío");

    const result = await generateText({
      model: google('gemini-2.5-flash-lite'), 
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'text', 
              text: VOICE_PROMPT 
            },
            {
              type: 'file',
              data: base64Content, 
              mediaType: 'audio/webm', 
            },
          ],
        },
      ],
    });

    // Limpieza por código: si el modelo manda por error "00:00", esto lo borra.
    let cleanText = result.text
      // Eliminar timestamps (00:00, 01:23, etc)
      .replace(/\d{1,2}:\d{2}/g, '') 
      // Eliminar saltos de línea excesivos y unirlos con espacios
      .replace(/\n+/g, ' ')
      // Quitar espacios dobles que quedan al borrar los tiempos
      .replace(/\s+/g, ' ')
      .trim();

    return { text: cleanText, success: true };
  } catch (error: any) {
    console.error('Error transcripción:', error);
    return { text: '', success: false, error: error.message };
  }
}