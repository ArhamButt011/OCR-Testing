import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import { Db } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";
const USER_COLLECTION = "users";

export async function POST(req: Request) {
  try {
    const { email, password }: { email: string; password: string } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      );
    }

    if (password.trim() === "") {
      return NextResponse.json(
        { message: "Password cannot be empty or contain only spaces." },
        { status: 400 }
      );
    }

    const db = await getDatabase();
    const user = await findUserByEmail(db, email);

    if (!user) {
      return NextResponse.json(
        { message: "User does not exist." },
        { status: 404 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await updatePassword(db, email, hashedPassword);

    return NextResponse.json(
      { message: "Password reset successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error during password reset:", error);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

async function getDatabase() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

async function findUserByEmail(db: Db, email: string) {
  return await db.collection(USER_COLLECTION).findOne({ email: email.toLowerCase() });
}

async function updatePassword(db: Db, email: string, hashedPassword: string) {
  await db.collection(USER_COLLECTION).updateOne(
    { email: email.toLowerCase() },
    { $set: { password: hashedPassword, updatedAt: new Date() } }
  );
}
