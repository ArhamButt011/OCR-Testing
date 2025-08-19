import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { NextResponse, NextRequest } from "next/server";

interface PDFCriteria {
  fromTime: Date;
  toTime: Date;
}

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function GET(req: NextRequest) {
  try {
    const id = new URL(req.url).pathname.split("/").pop();
    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const jobsCollection = db.collection("jobs");

    const job = await jobsCollection.findOne({ _id: new ObjectId(id) });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.log("Error fetching job:", error);
    return NextResponse.json(
      { error: "Failed to fetch job." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const id = new URL(req.url).pathname.split("/").pop();
    const body = await req.json();
    const {
      selectedDays,
      fromTime,
      toTime,
      everyTime,
      active,
      dayOffset,
      fetchLimit,
    } = body;
    console.log("Request body:", dayOffset);

    if (
      !selectedDays?.length ||
      !fromTime ||
      !toTime ||
      !everyTime ||
      dayOffset === undefined ||
      dayOffset === null ||
      fetchLimit === undefined ||
      fetchLimit === null
    ) {
      return NextResponse.json(
        { error: "All fields are required." },
        { status: 400 }
      );
    }

    const currentDate = new Date();

    const parseTime = (timeString: string): Date => {
      const [hours, minutes] = timeString.split(":").map(Number);
      const newDate = new Date(currentDate);
      newDate.setHours(hours, minutes, 0, 0);

      const timeZoneOffset = currentDate.getTimezoneOffset();
      newDate.setMinutes(newDate.getMinutes() - timeZoneOffset);

      return newDate;
    };

    const pdfCriteria: PDFCriteria = {
      fromTime: parseTime(fromTime),
      toTime: parseTime(toTime),
    };

    const client = await clientPromise;
    const db = client.db(DB_NAME);
    const jobsCollection = db.collection("jobs");

    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          selectedDays,
          fetchLimit,
          fromTime,
          toTime,
          everyTime,
          dayOffset,
          active,
          pdfCriteria: pdfCriteria,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Job updated successfully." });
  } catch (error) {
    console.log("Error updating job:", error);
    return NextResponse.json(
      { error: "Failed to update job." },
      { status: 500 }
    );
  }
}
