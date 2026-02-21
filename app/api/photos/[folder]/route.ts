import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|webp|heic|heif|avif|tiff|tif)$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ folder: string }> }
) {
  try {
    const { folder } = await params;
    // Sanitize: no path traversal
    const safe = folder.replace(/[^a-zA-Z0-9_\-]/g, '');
    const dir = path.join(process.cwd(), 'public', 'memories', safe);

    if (!fs.existsSync(dir)) {
      return NextResponse.json([]);
    }

    const files = fs
      .readdirSync(dir)
      .filter(f => IMAGE_EXTS.test(f))
      .sort(); // consistent ordering

    return NextResponse.json(files);
  } catch {
    return NextResponse.json([]);
  }
}
