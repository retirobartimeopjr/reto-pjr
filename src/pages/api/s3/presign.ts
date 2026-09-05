import type { APIRoute } from 'astro';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { fileName, fileType, folder, parroquiaName, username } = body;

        if (!fileName || !fileType || !folder) {
            return new Response(JSON.stringify({ success: false, error: 'Faltan parámetros' }), { status: 400 });
        }

        // Leer variables de entorno (puedes usar process.env en lugar de import.meta.env si es necesario)
        const region = import.meta.env.AWS_REGION || process.env.AWS_REGION || 'sa-east-1';
        const bucketName = import.meta.env.AWS_BUCKET_NAME || process.env.AWS_BUCKET_NAME || 'bartimeo-assets-prod';
        
        const accessKeyId = import.meta.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = import.meta.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;

        // Configurar cliente S3
        const s3Config: any = { region };
        
        if (accessKeyId && secretAccessKey) {
            s3Config.credentials = {
                accessKeyId,
                secretAccessKey,
            };
        }

        const s3Client = new S3Client(s3Config);

        // Construir la ruta (Key) del archivo
        // Ej: visits/San Pedro/Jesus_1678901234.jpg
        const timestamp = Date.now();
        const extension = fileName.split('.').pop() || 'jpg';
        
        let fileKey = `${folder}/`;
        if (folder === 'visits') {
            const cleanParroquia = (parroquiaName || 'Desconocida').replace(/[^a-zA-Z0-9]/g, '_');
            const cleanUser = (username || 'Usuario').replace(/[^a-zA-Z0-9]/g, '_');
            fileKey += `${cleanParroquia}/${cleanUser}_${timestamp}.${extension}`;
        } else if (folder === 'tickets') {
            const cleanUser = (username || 'Usuario').replace(/[^a-zA-Z0-9]/g, '_');
            fileKey += `${cleanUser}_${timestamp}.${extension}`;
        } else {
            const cleanFile = fileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_');
            fileKey += `${timestamp}_${cleanFile}.${extension}`;
        }

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: fileKey,
            ContentType: fileType,
        });

        // Generar URL firmada válida por 5 minutos
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

        // URL pública final (suponiendo que el bucket sea público por política)
        const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${fileKey}`;

        return new Response(JSON.stringify({ 
            success: true, 
            uploadUrl: presignedUrl, 
            publicUrl: publicUrl 
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error("Error generando Presigned URL:", error);
        return new Response(JSON.stringify({ success: false, error: 'Error interno generando URL' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
