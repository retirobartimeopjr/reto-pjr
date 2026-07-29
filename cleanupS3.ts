import { config } from 'dotenv';
config({ path: '.env.local' });
import { query } from './src/lib/db.js';
import { S3Client, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'sa-east-1';
const bucketName = process.env.AWS_BUCKET_NAME || 'bartimeo-assets-prod';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

const s3Client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey }
});

async function main() {
    try {
        console.log("Fetching DB urls...");
        const dbUrls = new Set<string>();
        
        const receiptsRes = await query(`SELECT receipt_url FROM ticket_registers WHERE receipt_url IS NOT NULL`);
        receiptsRes.rows.forEach(r => dbUrls.add(r.receipt_url));

        const photosRes = await query(`SELECT photo_url FROM user_parroquia_visits WHERE photo_url IS NOT NULL`);
        photosRes.rows.forEach(r => dbUrls.add(r.photo_url));

        console.log(`Found ${dbUrls.size} valid URLs in DB.`);

        let isTruncated = true;
        let continuationToken: string | undefined = undefined;
        let deletedCount = 0;
        let totalCount = 0;

        while (isTruncated) {
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                ContinuationToken: continuationToken,
            });
            const response = await s3Client.send(listCommand);
            
            for (const item of response.Contents || []) {
                if (!item.Key) continue;
                totalCount++;
                const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${item.Key}`;
                
                // Si la URL pública no está en la base de datos
                if (!dbUrls.has(publicUrl)) {
                    console.log(`Borrando archivo huérfano: ${item.Key}`);
                    await s3Client.send(new DeleteObjectCommand({ Bucket: bucketName, Key: item.Key }));
                    deletedCount++;
                }
            }

            isTruncated = response.IsTruncated || false;
            continuationToken = response.NextContinuationToken;
        }

        console.log(`Scan completo. Total S3: ${totalCount}. Eliminados: ${deletedCount}.`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
main();
