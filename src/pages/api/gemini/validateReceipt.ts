import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY || '');

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { base64Image, mimeType, expectedAmount } = body;

        if (!base64Image) {
            return new Response(JSON.stringify({ success: false, error: 'No image data provided' }), { status: 400 });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const prompt = `
            Actúa como un auditor financiero amigable. 
            Revisa esta imagen de un comprobante de pago/transferencia.
            
            Requisitos MÍNIMOS para que sea válido:
            1. No debe ser una imagen basura (como un perro, un paisaje, etc). Debe parecer un recibo o transferencia.
            2. Debe contener un valor transferido (dinero).
            
            Cosas que suman puntos de validez (no son estrictamente obligatorias pero si encuentras alguna es excelente):
            - Aparece la palabra "nicolas" o "Nicolás"
            - Aparece el número de cuenta "3182004659"
            
            El usuario afirma haber transferido al menos $${expectedAmount}.
            
            Responde ÚNICAMENTE con un objeto JSON (sin markdown, sin comillas invertidas) con esta estructura exacta:
            {
                "isValid": true/false,
                "extractedAmount": número (el valor que veas, o 0 si no hay),
                "reason": "Explicación MUY CORTA, MÁXIMO 10 PALABRAS, directa y al grano de por qué es inválido. SIEMPRE incluye al final de esta frase: 'Por favor, vuelve a subir tu comprobante.'"
            }
        `;

        const imagePart = {
            inlineData: {
                data: base64Image,
                mimeType
            }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text();
        
        // Limpiar el texto en caso de que Gemini devuelva markdown
        const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        
        let aiResult;
        try {
            aiResult = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Error parsing Gemini JSON:", cleanedText);
            return new Response(JSON.stringify({ success: false, error: 'Invalid response from AI' }), { status: 500 });
        }

        return new Response(JSON.stringify({
            success: true,
            isValid: aiResult.isValid,
            extractedAmount: aiResult.extractedAmount,
            reason: aiResult.reason
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Gemini Validation Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500 });
    }
};
