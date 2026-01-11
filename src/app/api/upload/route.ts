import { mkdir, writeFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function POST(request: NextRequest) {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const parishName = data.get('parishName') as string;
    const userId = 'user_123'; // Mock user ID

    if (!file) {
        return NextResponse.json({ success: false, message: 'No file uploaded' }, { status: 400 });
    }

    if (!parishName) {
        return NextResponse.json({ success: false, message: 'No parish name provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize parish name for folder creation
    const safeParishName = parishName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', safeParishName);

    try {
        await mkdir(uploadDir, { recursive: true });
        const filePath = path.join(uploadDir, `${userId}.jpg`);
        await writeFile(filePath, buffer);
        console.log(`Saved file to ${filePath}`);
        return NextResponse.json({ success: true, path: `/uploads/${safeParishName}/${userId}.jpg` });
    } catch (error) {
        console.error('Error saving file:', error);
        return NextResponse.json({ success: false, message: 'Error saving file' }, { status: 500 });
    }
}
