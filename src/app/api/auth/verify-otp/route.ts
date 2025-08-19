import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import clientPromise from "@/lib/mongodb";
import { Db } from "mongodb";


const DB_NAME = process.env.DB_NAME || "my-next-app";
const OTP_COLLECTION = "otps";

export async function POST(req: NextRequest) {
  try {
    const { email, otp }: { email: string; otp: string } = await req.json();

    if (!email || !otp) {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    const db = await getDatabase();
    const otpData = await getOtpFromDb(db, email);

    if (!otpData) {
      return NextResponse.json({ message: "OTP not found or expired." }, { status: 400 });
    }

    if (otpData.otp === otp) {
      const token = jwt.sign({ email }, process.env.JWT_SECRET as string, { expiresIn: "1h" });

      return NextResponse.json(
        { message: "OTP verified successfully.", token },
        { status: 200 }
      );
    } else {
      return NextResponse.json({ message: "OTP verification failed." }, { status: 400 });
    }
  } catch (error) {
    console.log("Error during OTP verification:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

async function getDatabase() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

async function getOtpFromDb(db: Db, email: string) {
  const collection = db.collection(OTP_COLLECTION);
  return await collection.findOne({ email: email.toLowerCase() });
}
