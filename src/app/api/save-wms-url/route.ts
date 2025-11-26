import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { withLogging } from "@/lib/apiWrapper";

async function getHandler(req: Request | any, context?: any) {
  try {
    const client = await clientPromise;
    const db = client.db("my-next-app");
    const collection = db.collection("wms_urls");

    const existing = await collection.findOne(
      {},
      { projection: { _id: 0, wmsUrl: 1, username: 1, password: 1, hostName: 1, port: 1, serviceName: 1 } }
    );

    return NextResponse.json(
      existing || { wmsUrl: "", username: "", password: "", hostName: "", port: "", serviceName: "" }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function postHandler(req: Request | any, context?: any) {
  try {
    const { username, password, hostName, port, serviceName } = await req.json();

    if (!username || !password || !hostName || !port || !serviceName) {
      return NextResponse.json(
        {
          error: "username, hostName, port, serviceName, and password are required",
        },
        { status: 400 }
      );
    }

    const wmsUrl = `http://${hostName}:${port}/sap/opu/odata/sap/${serviceName}/`;

    const client = await clientPromise;
    const db = client.db("my-next-app");
    const collection = db.collection("wms_urls");

    await collection.updateOne(
      {},
      { $set: { wmsUrl, username, password, hostName, port, serviceName } },
      { upsert: true }
    );

    return NextResponse.json({
      message: "username, hostName, port, serviceName, and password saved successfully",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export const GET = withLogging(getHandler);
export const POST = withLogging(postHandler);
