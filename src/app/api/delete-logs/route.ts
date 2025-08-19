import { NextResponse } from 'next/server';
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function POST(req: Request) {
  try {
    const { ids } = await req.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No valid IDs provided for deletion' }, { status: 400 });
    }

    const objectIds = ids.map((id) => new ObjectId(id));

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const logsCollection = db.collection('logs'); // make sure this collection exists

    const logsToDelete = await logsCollection.find({ _id: { $in: objectIds } }).toArray();

    if (logsToDelete.length === 0) {
      return NextResponse.json({ message: 'No logs found for deletion' }, { status: 404 });
    }

    const deleteResult = await logsCollection.deleteMany({ _id: { $in: objectIds } });

    return NextResponse.json({
      message: 'Logs deleted successfully',
      deletedCount: deleteResult.deletedCount,
    }, { status: 200 });

  } catch (error) {
    console.error('Error deleting logs:', error);
    return NextResponse.json({ error: 'Failed to delete logs' }, { status: 500 });
  }
}
