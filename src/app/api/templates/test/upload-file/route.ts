// src/app/api/upload-file/route.ts
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { withLogging } from "@/lib/apiWrapper";

// File size limits
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Allowed file types
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/tiff",
  "image/tif",
  "image/bmp",
];

const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".gif", ".tiff", ".tif", ".bmp"];

async function uploadFileHandler(
  request: NextRequest | Request,
  context?: any
): Promise<NextResponse> {
  try {
    const req = request as NextRequest;
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    console.log(`[UPLOAD-FILE] Uploading file: ${file.name}, size: ${file.size} bytes`);

    // Check file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          success: false,
          error: `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${MAX_FILE_SIZE_MB}MB`,
        },
        { status: 413 }
      );
    }

    // Check file type
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type: ${ext}. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid MIME type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Create unique filename with timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_"); // Sanitize filename
    const uniqueFilename = `${path.parse(originalName).name}_${timestamp}_${randomSuffix}${ext}`;

    // Ensure the public/file directory exists
    const uploadDir = path.join(process.cwd(), "public/file");
    if (!fs.existsSync(uploadDir)) {
      console.log(`[UPLOAD-FILE] Creating directory: ${uploadDir}`);
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, uniqueFilename);
    console.log(`[UPLOAD-FILE] Saving file to: ${filePath}`);

    // Convert File to Buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    fs.writeFileSync(filePath, buffer);
    console.log(`[UPLOAD-FILE] File saved successfully: ${uniqueFilename}`);

    return NextResponse.json({
      success: true,
      filename: uniqueFilename,
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      message: "File uploaded successfully",
    });
  } catch (error: any) {
    console.error("[UPLOAD-FILE] Error uploading file:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to upload file",
      },
      { status: 500 }
    );
  }
}

export const POST = withLogging(uploadFileHandler);

// Disable body parser size limit for file uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb",
    },
  },
};