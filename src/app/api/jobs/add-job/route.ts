import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

const DB_NAME = process.env.DB_NAME || "my-next-app";

async function getJobsCollection() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  return db.collection("jobs");
}

interface PDFCriteria {
  fromTime: Date;
  toTime: Date;
}

export async function POST(req: Request) {
  try {
    const jobsCollection = await getJobsCollection();
    const body = await req.json();
    const { selectedDays, fromTime, toTime, everyTime, dayOffset, fetchLimit } =
      body;

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

    const latestJob = await jobsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    let nextJobNumber = 1;
    if (latestJob.length > 0 && latestJob[0].jobName?.startsWith("Job #")) {
      const lastJobNumber = parseInt(
        latestJob[0].jobName.replace("Job #", ""),
        10
      );
      nextJobNumber = isNaN(lastJobNumber) ? 1 : lastJobNumber + 1;
    }

    const jobName = `Job #${nextJobNumber}`;

    const result = await jobsCollection.insertOne({
      jobName,
      fetchLimit,
      selectedDays,
      dayOffset,
      fromTime,
      toTime,
      everyTime,
      pdfCriteria: pdfCriteria,
      active: false,
      createdAt: new Date(),
    });

    return NextResponse.json(
      { message: "Job added successfully.", data: result },
      { status: 201 }
    );
  } catch (error) {
    console.log("Error adding job:", error);
    return NextResponse.json({ error: "Failed to add job." }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const jobsCollection = await getJobsCollection();
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const skip = (page - 1) * limit;
    const searchQuery =
      url.searchParams.get("search")?.trim().toLowerCase() || "";

    let filter = {};

    const activeKeywords = ["ac", "active", "act", "acti", "activ"];
    const inactiveKeywords = [
      "in",
      "inactive",
      "inact",
      "ina",
      "inac",
      "inacti",
      "inactiv",
    ];

    if (searchQuery) {
      if (activeKeywords.some((keyword) => searchQuery === keyword)) {
        filter = { active: true };
      } else if (inactiveKeywords.some((keyword) => searchQuery === keyword)) {
        filter = { active: false };
      }
      // else {
      //   filter = { selectedDays: { $regex: searchQuery, $options: "i" } };
      // }
    }

    const [jobs, totalJobs] = await Promise.all([
      jobsCollection.find(filter).skip(skip).limit(limit).toArray(),
      jobsCollection.countDocuments(filter),
    ]);

    return NextResponse.json(
      { jobs, totalJobs, page, totalPages: Math.ceil(totalJobs / limit) },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error fetching jobs:", error);
    return NextResponse.json(
      { error: "Failed to fetch jobs." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const jobsCollection = await getJobsCollection();
    const { id, active } = await req.json();

    if (!id || typeof active !== "boolean") {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "Invalid ObjectId format." },
        { status: 400 }
      );
    }

    const result = await jobsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { active } }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Job status updated successfully." },
      { status: 200 }
    );
  } catch (error) {
    console.log("Error updating job status:", error);
    return NextResponse.json(
      { error: "Failed to update job status." },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({ allowedMethods: ["POST", "GET", "PATCH"] });
}
