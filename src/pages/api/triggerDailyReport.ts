import type { APIRoute } from 'astro';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export const POST: APIRoute = async () => {
    try {
        // Ejecutar el script que ya existe usando node
        const { stdout, stderr } = await execPromise('node scripts/daily_report.js');
        
        console.log('Daily Report Triggered:', stdout);
        if (stderr) {
            console.error('Daily Report Stderr:', stderr);
        }

        return new Response(JSON.stringify({ success: true, message: "Reporte enviado con éxito." }), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });
    } catch (error) {
        console.error("❌ Error ejecutando reporte manual:", error);
        return new Response(JSON.stringify({ error: "No se pudo ejecutar el reporte", details: String(error) }), { status: 500 });
    }
};
