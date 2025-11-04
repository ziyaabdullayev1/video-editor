import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    
    // Security: Prevent path traversal
    if (filename.includes('..') || filename.includes('/')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }

    const filePath = path.join(process.cwd(), 'public', 'exports', filename);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await readFile(filePath);

    // Return file as download
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });

  } catch (error: any) {
    console.error('❌ Download error:', error);
    return NextResponse.json(
      { error: 'Download failed', message: error.message },
      { status: 500 }
    );
  }
}

