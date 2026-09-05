import type { APIRoute } from 'astro';
import { query } from '../../lib/db';
import { APP_VERSION } from '../../config/version';

import { jwtVerify } from 'jose';

export const GET: APIRoute = async ({ request, url, cookies }) => {
    try {
        const userId = url.searchParams.get('userId');
        
        if (!userId) {
            return new Response(JSON.stringify({ 
                valid: false, 
                version: APP_VERSION,
                error: 'Missing userId'
            }), { 
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        const token = cookies.get('auth_token')?.value;
        if (!token) {
            return new Response(JSON.stringify({ valid: false, reason: 'No token' }), { 
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
        try {
            const secret = new TextEncoder().encode(import.meta.env.JWT_SECRET || process.env.JWT_SECRET);
            await jwtVerify(token, secret);
        } catch (e) {
            return new Response(JSON.stringify({ valid: false, reason: 'Invalid or expired token' }), { 
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        // Verify if the user exists and is active in the database
        const userRes = await query(`
            SELECT u.id, us.is_active 
            FROM users u
            LEFT JOIN user_stats us ON u.id = us.user_id
            WHERE u.id = $1
        `, [userId]);

        if (userRes.rowCount === 0) {
            return new Response(JSON.stringify({ 
                valid: false, 
                version: APP_VERSION,
                reason: 'User not found'
            }), { 
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        // All good, valid session
        return new Response(JSON.stringify({ 
            valid: true, 
            version: APP_VERSION 
        }), { 
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (e) {
        console.error("Session check error:", e);
        // On server error, we return HTTP 500. 
        // We do NOT return valid: false because we don't want to log the user out due to a temporary DB crash.
        return new Response(JSON.stringify({ 
            error: 'Server error',
            version: APP_VERSION
        }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
