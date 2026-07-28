import type { APIRoute } from 'astro';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { fileUrl } = body;

        if (!fileUrl) {
            return new Response(JSON.stringify({ error: 'Falta la URL del archivo' }), { status: 400 });
        }

        const region = import.meta.env.AWS_REGION || process.env.AWS_REGION || 'sa-east-1';
        const bucketName = import.meta.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'bartimeo-assets-prod';
        
        const baseUrl = `https://${bucketName}.s3.${region}.amazonaws.com/`;
        
        // Si la URL no pertenece a este bucket, devolverla tal cual
        if (!fileUrl.startsWith(baseUrl)) {
            return new Response(JSON.stringify({ url: fileUrl }), { status: 200 });
        }

        // Extraer el Key quitando la URL base
        const fileKey = fileUrl.replace(baseUrl, '');

        const accessKeyId = import.meta.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = import.meta.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

        const s3Config: any = { region };
        
        if (accessKeyId && secretAccessKey) {
            s3Config.credentials = {
                accessKeyId,
                secretAccessKey,
            };
        }

        const s3Client = new S3Client(s3Config);
        
        // Decodificar el Key por si tiene espacios (%20) u otros caracteres especiales
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: decodeURIComponent(fileKey),
        });

        // Generar una URL válida por 1 hora (3600 segundos) para visualización
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

        return new Response(JSON.stringify({ url: presignedUrl }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error("Error generando Presigned GET URL:", error);
        return new Response(JSON.stringify({ error: 'Error interno generando URL de lectura' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
