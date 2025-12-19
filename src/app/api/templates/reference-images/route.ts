// src/app/api/templates/reference-images/route.ts
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const UPLOAD_DIR = path.join(process.cwd(), "public", "templates", "images");
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGES = 5;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

export async function uploadImageHandler(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const formData = await req.formData();
    const files = formData.getAll("images") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No images provided" },
        { status: 400 }
      );
    }

    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} images allowed` },
        { status: 400 }
      );
    }

    const uploadedImages = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          {
            error: `Invalid file type: ${
              file.name
            }. Allowed: ${ALLOWED_TYPES.join(", ")}`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds 10MB limit` },
          { status: 400 }
        );
      }

      const imageId = uuidv4();
      const extension = file.name.split(".").pop();
      const filename = `${imageId}.${extension}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filepath, buffer);

      uploadedImages.push({
        image_id: imageId,
        file_path: `/api/templates/serve-image/${filename}`,
        original_name: file.name,
        size: file.size,
        mime_type: file.type,
      });
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const imagesCollection = db.collection("reference_images");

    await imagesCollection.insertMany(
      uploadedImages.map((img) => ({
        ...img,
        uploaded_at: new Date(),
      }))
    );

    return NextResponse.json({
      success: true,
      images: uploadedImages,
      count: uploadedImages.length,
      message: `${uploadedImages.length} image(s) uploaded successfully`,
    });
  } catch (error) {
    console.error("Error uploading images:", error);
    return NextResponse.json(
      { error: "Failed to upload images", details: String(error) },
      { status: 500 }
    );
  }
}

export async function getImageHandler(
  req: NextRequest | Request
): Promise<NextResponse> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const imagesCollection = db.collection("reference_images");

    const images = await imagesCollection
      .find()
      .sort({ uploaded_at: -1 })
      .toArray();

    return NextResponse.json({
      success: true,
      images,
      count: images.length,
    });
  } catch (error) {
    console.error("Error listing images:", error);
    return NextResponse.json(
      { error: "Failed to list images", details: String(error) },
      { status: 500 }
    );
  }
}

export const POST = withLogging(uploadImageHandler);
export const GET = withLogging(getImageHandler);
