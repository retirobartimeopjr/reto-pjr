
import type { APIRoute } from 'astro';
import { readSheet } from '../../lib/googleSheets';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { phone, code } = body;

        if (!phone || !code) {
            return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400 });
        }


        // Fetch columns A (code) and B (phone) from 'userticket' sheet
        const rows = await readSheet('userticket!A:B');

        if (!rows || rows.length === 0) {
            return new Response(JSON.stringify({ error: "No users found" }), { status: 401 });
        }

        // Normalize inputs for comparison
        const targetPhone = String(phone).trim();
        const targetCode = String(code).trim();

        // Check if there is a match
        // Row format: [code, phone]
        const isValidUser = rows.some(row => {
            const rowCode = String(row[0] || '').trim();
            const rowPhone = String(row[1] || '').trim();
            return rowCode === targetCode && rowPhone === targetPhone;
        });

        if (isValidUser) {
            return new Response(JSON.stringify({ success: true, message: "Login successful" }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            return new Response(JSON.stringify({ error: "Invalid credentials" }), { status: 401 });
        }

    } catch (error) {
        console.error("Login API Error", error);
        return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
    }
}
