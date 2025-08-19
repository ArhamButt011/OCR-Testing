import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function POST(req: Request) {
  try {
    const { name, email, password, role } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { message: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { message: "Role is required" },
        { status: 400 }
      );
    }

    if (name.trim() === "") {
      return NextResponse.json(
        { message: "Name cannot be empty or contain only spaces" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase();
    let formattedRole = role.replace(/\s+/g, '').toLowerCase();

    const client = await clientPromise;
    const db = client.db(DB_NAME);

    const existingUser = await db.collection("users").findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { message: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let num = 0;

    const user = await db.collection("users").findOne({ email: "admin@gmail.com" });

    if (!user) {
      if (normalizedEmail == "admin@gmail.com") {
        num = 3;
        formattedRole = 'admin';
      }
    }

    await db.collection("users").insertOne({
      name: name.trim(),
      email: normalizedEmail,
      status: num, // 3 for admin, 0 for pending, 1 for accepted, 2 for rejected 
      role: formattedRole,
      password: hashedPassword,
      createdAt: new Date(),
    });

    return NextResponse.json(
      { message: "User created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.log("Error creating user:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
