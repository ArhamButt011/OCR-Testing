// lib/addLog.ts
import clientPromise from "@/lib/mongodb";

export async function addLog(
//   fileId: string | null,
//   message: string,
//   logDescription: string,
//   status: number
) {
  try {
    const client = await clientPromise;
    const db = client.db("my-next-app");
    const logsCollection = db.collection("logs");

    let statusLabel = "unknown";

    if (status === 200) {
      statusLabel = "success";
    } else if (status === 404) {
      statusLabel = "not_found";
    } else if (status >= 500) {
      statusLabel = "error";
    }

    await logsCollection.insertOne({
      fileId,
      message,
      logDescription,
      status,
      statusLabel,
      timestamp: new Date(),
    });
  } catch (logErr) {
    console.error("Error logging to MongoDB:", logErr);
  }
}
