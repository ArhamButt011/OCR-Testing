import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import clientPromise from "@/lib/mongodb";
import { Db } from "mongodb";


const DB_NAME = process.env.DB_NAME || "my-next-app";
const USERS_COLLECTION = "users";
const OTPS_COLLECTION = "otps";

export async function POST(req: NextRequest) {
  try {
    const { email }: { email: string } = await req.json();

    const emailError = validateEmail(email);
    if (emailError) {
      return NextResponse.json({ message: emailError }, { status: 400 });
    }

    const db = await getDatabase();
    const userExists = await checkUserExists(db, email);
    if (!userExists) {
      return NextResponse.json(
        { message: "Email does not exist in our system or the account is pending/rejected." },
        { status: 404 }
      );
    }

    const otpData = await db.collection(OTPS_COLLECTION).findOne({ email });
    if (otpData && Date.now() - otpData.timestamp < 60 * 1000) {
      return NextResponse.json(
        { message: "OTP already sent. Please wait for 1 minute." },
        { status: 400 }
      );
    }

    const otp = generateOtp();
    await saveOrUpdateOtp(db, email, otp);
    await sendOtpEmail(email, otp);

    return NextResponse.json({ message: "OTP sent to your email!" }, { status: 200 });
  } catch (error) {
    console.log("Error in POST handler:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

function validateEmail(email: string): string | null {
  if (!email) return "Email is required.";
  const emailRegex = /^\S+@\S+\.\S+$/;
  return emailRegex.test(email) ? null : "Please enter a valid email address.";
}

function generateOtp(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function getDatabase() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

async function checkUserExists(db: Db, email: string): Promise<boolean> {
  const user = await db.collection(USERS_COLLECTION).findOne({
    email: email.toLowerCase(),
    status: 1,
  });
  return Boolean(user);
}

async function saveOrUpdateOtp(db: Db, email: string, otp: string): Promise<void> {
  const timestamp = Date.now();
  const otpData = { email: email.toLowerCase(), otp, timestamp };

  await db.collection(OTPS_COLLECTION).updateOne(
    { email: otpData.email },
    { $set: otpData },
    { upsert: true }
  );
}

async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is: ${otp}`,
  });
}
