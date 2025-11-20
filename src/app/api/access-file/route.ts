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

  if (!filename) {
    return NextResponse.json(
      { message: "Filename is required" },
      { status: 400 }
    );
  }

  const filePath = path.join(process.cwd(), "public/file", filename);
  console.log("file path-> ", filePath);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ message: "File not found" }, { status: 404 });
  }

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