import { NextResponse } from "next/server";

export async function POST() {
    try {
        return NextResponse.json({ message: "Logout successful" }, { status: 200 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
