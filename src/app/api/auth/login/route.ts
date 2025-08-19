import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/mongodb";

const SECRET_KEY = process.env.JWT_SECRET as string;
const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function POST(req: Request) {
  try {
    const { email, password, role } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const normalizedEmail = email.toLowerCase();

    const user = await db.collection("users").findOne({
      email: normalizedEmail,
      ...(role ? { role } : {}),
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found or invalid role" },
        { status: 404 }
      );
    }

    if (user.status === 0) {
      return NextResponse.json(
        { message: "Account pending approval. Contact admin." },
        { status: 403 }
      );
    }

    if (user.status === 2) {
      return NextResponse.json(
        { message: "Account rejected. Please reapply." },
        { status: 403 }
      );
    }

    if (!role && user.role === "admin") {
      return NextResponse.json(
        { message: "Admins cannot log in as users." },
        { status: 403 }
      );
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return NextResponse.json(
        { message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      { email: user.email, id: user._id, role: user.role, username: user.name },
      SECRET_KEY,
      { expiresIn: "24h" }
    );

    return NextResponse.json(
      { message: "Login successful", token, name: user.name, role: user.role },
      { status: 200 }
    );
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
