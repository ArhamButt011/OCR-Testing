// src/app/api/templates/reference-images/[imageId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import jwt from "jsonwebtoken";
import { withLogging } from "@/lib/apiWrapper";

const SECRET_KEY = process.env.JWT_SECRET as string;
const UPLOAD_DIR = path.join(process.cwd(), "public", "templates", "reference-images");

// ============== DELETE REFERENCE IMAGE ==============
async function deleteImageHandler(req: NextRequest): Promise<NextResponse> {
  try {
    // const token = req.headers.get("Authorization")?.split(" ")[1];
    // if (!token) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // jwt.verify(token, SECRET_KEY);

    const url = new URL(req.url);
    const pathSegments = url.pathname.split("/");
    const imageId = pathSegments[pathSegments.length - 1];

    if (!imageId) {
      return NextResponse.json({ error: "Image ID required" }, { status: 400 });
    }

    // Find file with this imageId
    const files = await fs.readdir(UPLOAD_DIR);
    const imageFile = files.find((f) => f.startsWith(imageId));

    if (!imageFile) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const filePath = path.join(UPLOAD_DIR, imageFile);
    await fs.unlink(filePath);

    return NextResponse.json({
      success: true,
      message: "Image deleted successfully",
      image_id: imageId,
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