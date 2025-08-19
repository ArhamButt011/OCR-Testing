import { NextRequest, NextResponse } from "next/server";
import jwt, { TokenExpiredError, JsonWebTokenError } from "jsonwebtoken";

const SECRET_KEY = process.env.JWT_SECRET as string;

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("Authorization")?.split(" ")[1];

    if (!token) {
      return NextResponse.json(
        { message: "Authentication token is missing" },
        { status: 401 }
      );
    }

    const decoded = jwt.verify(token, SECRET_KEY) as { role: string };

    if (!["admin", "standarduser", "reviewer"].includes(decoded.role)) {
      return NextResponse.json(
        { message: "Access denied. Invalid role." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { message: "Authorized", data: decoded.role },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return NextResponse.json(
        { message: "Token has expired" },
        { status: 401 }
      );
    }

    if (error instanceof JsonWebTokenError) {
      return NextResponse.json(
        { message: "Invalid token" },
        { status: 401 }
      );
    }

    console.error("Unexpected error during role check:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

