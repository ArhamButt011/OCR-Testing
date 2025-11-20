import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// File size limits
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const STREAM_THRESHOLD_BYTES = 10 * 1024 * 1024; // 10MB - use streaming for larger files

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");

  console.log(`[ACCESS-FILE] Request received for filename: ${filename}`);

  if (!filename) {
    console.error("[ACCESS-FILE] No filename provided in request");
    return NextResponse.json(
      { message: "Filename is required" },
      { status: 400 }
    );
  }

  const filePath = path.join(process.cwd(), "public/file", filename);
  console.log(`[ACCESS-FILE] Resolved file path: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`[ACCESS-FILE] File not found: ${filePath}`);
    console.error(`[ACCESS-FILE] Checked directory: ${path.join(process.cwd(), "public/file")}`);

    // List files in directory for debugging
    try {
      const publicFileDir = path.join(process.cwd(), "public/file");
      if (fs.existsSync(publicFileDir)) {
        const files = fs.readdirSync(publicFileDir);
        console.error(`[ACCESS-FILE] Available files in directory (${files.length} total):`);
        if (files.length <= 10) {
          files.forEach(f => console.error(`  - ${f}`));
        } else {
          files.slice(0, 5).forEach(f => console.error(`  - ${f}`));
          console.error(`  ... and ${files.length - 5} more files`);
        }
      } else {
        console.error(`[ACCESS-FILE] Directory does not exist: ${publicFileDir}`);
      }
    } catch (listErr) {
      console.error(`[ACCESS-FILE] Could not list directory:`, listErr);
    }

    return NextResponse.json({ message: "File not found", requestedFile: filename }, { status: 404 });
  }

  console.log(`[ACCESS-FILE] File found: ${filename}`);

  // Check file size
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;

  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        message: `File too large: ${(fileSize / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${MAX_FILE_SIZE_MB}MB`,
        fileSize: fileSize,
        maxSize: MAX_FILE_SIZE_BYTES
      },
      { status: 413 } // Payload Too Large
    );
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".bmp": "image/bmp",
  };
  const contentType = mimeTypes[ext] || "application/octet-stream";

  // Use streaming for large files (> 10MB)
  if (fileSize > STREAM_THRESHOLD_BYTES) {
    console.log(`Streaming large file: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)}MB)`);

    const fileStream = fs.createReadStream(filePath, {
      highWaterMark: 64 * 1024 // 64KB chunks for better performance
    });

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(readableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileSize.toString(),
        "Content-Disposition": `inline; filename="${filename}"`,
        "Accept-Ranges": "bytes", // Enable range requests for resumable downloads
      },
    });
  }

  // For smaller files, read fully (more efficient for small files)
  console.log(`Reading small file: ${filename} (${(fileSize / 1024).toFixed(2)}KB)`);
  const fileStream = fs.createReadStream(filePath);
  const readableStream = new ReadableStream({
    start(controller) {
      fileStream.on("data", (chunk) => controller.enqueue(chunk));
      fileStream.on("end", () => controller.close());
      fileStream.on("error", (err) => controller.error(err));
    },
  });

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}