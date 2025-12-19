import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { existsSync } from "fs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "templates", "images");

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    const filename = params.filename;
    const filepath = path.join(UPLOAD_DIR, filename);

    console.log("🔍 Image request:", filename);
    console.log("📁 Full path:", filepath);
    console.log("✓ Exists:", existsSync(filepath));

    if (!existsSync(filepath)) {
      console.error("❌ File not found:", filepath);
      return NextResponse.json(
        { 
          error: "Image not found", 
          filename,
          path: filepath,
          uploadDir: UPLOAD_DIR 
        },
        { status: 404 }
      );
    }

    const imageBuffer = await readFile(filepath);
    
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const contentType = contentTypes[ext] || 'image/png';

    console.log("✅ Serving:", filename, "Type:", contentType, "Size:", imageBuffer.length);

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error("❌ Error serving image:", error);
    return NextResponse.json(
      { 
        error: "Failed to serve image", 
        details: String(error),
        filename: params.filename 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}