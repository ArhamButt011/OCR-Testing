// src/app/api/templates/reference-images/[imageId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const UPLOAD_DIR = path.join(process.cwd(), "public", "templates", "images");

export async function deleteImageHandler(
  req: NextRequest | Request,
  { params }: any
): Promise<NextResponse> {
  try {
    console.log("🗑️ Delete request for image:", params.imageId);

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const imagesCollection = db.collection("reference_images");

    const image = await imagesCollection.findOne({
      image_id: params.imageId,
    });

    if (!image) {
      console.log("❌ Image not found:", params.imageId);
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    // ✅ Extract filename from file_path (handles both old and new paths)
    const filename = path.basename(image.file_path);
    const filepath = path.join(UPLOAD_DIR, filename);

    console.log("Attempting to delete file:", filepath);

    if (existsSync(filepath)) {
      await unlink(filepath);
      console.log("✅ File deleted from disk");
    } else {
      console.log("⚠️ File not found on disk:", filepath);
    }

    await imagesCollection.deleteOne({
      image_id: params.imageId,
    });

    console.log("✅ Image deleted from database");

    return NextResponse.json({
      success: true,
      image_id: params.imageId,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete image", details: String(error) },
      { status: 500 }
    );
  }
}

export const DELETE = withLogging(deleteImageHandler);