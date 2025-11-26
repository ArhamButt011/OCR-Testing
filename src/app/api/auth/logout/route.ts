import { NextResponse } from "next/server";
import { withLogging } from "@/lib/apiWrapper";

async function logoutHandler() {
    try {
        return NextResponse.json({ message: "Logout successful" }, { status: 200 });
    } catch (error) {
        console.log(error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

export const POST = withLogging(logoutHandler);
