"use server";

import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function transcribeAudio(
  audioBase64: string
): Promise<{ text: string; success: boolean; error?: string }> {
  try {
    // Log para debug
    console.log("[Transcribe] Starting transcription...");
    console.log("[Transcribe] Audio length:", audioBase64.length);
    console.log("[Transcribe] API Key exists:", !!process.env.GOOGLE_GENERATIVE_AI_API_KEY);
    
    // Determinar el mimeType del data URL
    const mimeTypeMatch = audioBase64.match(/^data:(audio\/[^;]+);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "audio/webm";
    console.log("[Transcribe] Detected mimeType:", mimeType);

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: 'Transcribe este audio de un técnico de mantenimiento. Elimina muletillas ("eh", "mmm", "este"), corrige términos técnicos mal pronunciados y formatea el texto de forma clara y concisa. Solo devuelve el texto transcrito, sin explicaciones adicionales.',
            },
            {
              type: "file",
              data: audioBase64,
              mediaType: mimeType,
            },
          ],
        },
      ],
    });

    console.log("[Transcribe] Success! Text:", result.text.substring(0, 100));
    return { text: result.text, success: true };
  } catch (error: any) {
    console.error("[Transcribe] ERROR:", error);
    console.error("[Transcribe] Error message:", error?.message);
    console.error("[Transcribe] Error stack:", error?.stack);
    return { 
      text: "", 
      success: false, 
      error: error?.message || "Error desconocido" 
    };
  }
}

