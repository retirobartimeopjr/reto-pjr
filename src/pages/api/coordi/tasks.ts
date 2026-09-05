import type { APIRoute } from 'astro';
import { query } from '../../../lib/db';
import bcrypt from 'bcryptjs';

// Reusable function to verify admin
async function verifyAdmin(username?: string, password?: string) {
    if (!username || !password) return false;
    const res = await query('SELECT password FROM admins WHERE username = $1', [username]);
    if (res.rowCount === 0) return false;
    const isValid = await bcrypt.compare(password, res.rows[0].password);
    return isValid;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { username, password, action } = body;

        if (!(await verifyAdmin(username, password))) {
            return new Response(JSON.stringify({ error: 'Credenciales inválidas' }), { status: 401 });
        }

        if (action === 'list') {
            const res = await query('SELECT * FROM retiro_tasks ORDER BY created_at ASC');
            return new Response(JSON.stringify({ success: true, tasks: res.rows }), { status: 200 });
        }
        
        if (action === 'create') {
            const { task_text } = body;
            if (!task_text) return new Response(JSON.stringify({ error: 'Texto de tarea requerido' }), { status: 400 });
            
            const res = await query(`
                INSERT INTO retiro_tasks (task_text) 
                VALUES ($1) 
                RETURNING *
            `, [task_text]);
            
            return new Response(JSON.stringify({ success: true, task: res.rows[0] }), { status: 200 });
        }
        
        if (action === 'toggle') {
            const { task_id, is_completed } = body;
            if (!task_id) return new Response(JSON.stringify({ error: 'ID de tarea requerido' }), { status: 400 });
            
            const res = await query(`
                UPDATE retiro_tasks 
                SET is_completed = $1 
                WHERE id = $2 
                RETURNING *
            `, [is_completed, task_id]);
            
            return new Response(JSON.stringify({ success: true, task: res.rows[0] }), { status: 200 });
        }
        
        if (action === 'delete') {
            const { task_id } = body;
            if (!task_id) return new Response(JSON.stringify({ error: 'ID de tarea requerido' }), { status: 400 });
            
            await query('DELETE FROM retiro_tasks WHERE id = $1', [task_id]);
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        return new Response(JSON.stringify({ error: 'Acción no válida' }), { status: 400 });
    } catch (error) {
        console.error("Error en tasks API:", error);
        return new Response(JSON.stringify({ error: 'Error del servidor' }), { status: 500 });
    }
};
