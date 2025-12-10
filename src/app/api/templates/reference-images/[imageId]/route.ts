// src/app/api/templates/reference-images/[imageId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const SECRET_KEY = process.env.JWT_SECRET as string;
const UPLOAD_DIR = path.join(process.cwd(), "public", "templates", "images");

export async function deleteImageHandler(
  req: NextRequest | Request,
  { params }: any
): Promise<NextResponse> {
  try {
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const imagesCollection = db.collection("reference_images");

    const image = await imagesCollection.findOne({
      image_id: params.imageId,
    });

    if (!image) {
      return NextResponse.json(
        { error: "Image not found or unauthorized" },
        { status: 404 }
      );
    }

    const filename = path.basename(image.file_path);
    const filepath = path.join(UPLOAD_DIR, filename);

    if (existsSync(filepath)) {
      await unlink(filepath);
    }

    await imagesCollection.deleteOne({
      image_id: params.imageId,
    });

    return NextResponse.json({
      success: true,
      image_id: params.imageId,
      message: "Image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: "Failed to delete image", details: String(error) },
      { status: 500 }
    );
  }
}

export const DELETE = withLogging(deleteImageHandler);
