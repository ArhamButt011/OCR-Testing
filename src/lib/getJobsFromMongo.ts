import { Filter, ObjectId } from "mongodb";
import { format, parse } from "date-fns";
import clientPromise from "@/lib/mongodb";
import { NextResponse } from "next/server";

interface Job {
  _id?: ObjectId;
  blNumber: string | number;
  jobName?: string;
  podDate?: string;
  fileName?: string;
  deliveryDate?: Date;
  podSignature?: string;
  totalQty?: number;
  received?: number;
  damaged?: number;
  short?: number;
  over?: number;
  refused?: number;
  noOfPages?: number;
  stampExists?: string;
  finalStatus?: string;
  reviewStatus?: string;
  recognitionStatus?: string;
  breakdownReason?: string;
  reviewedBy?: string;
  cargoDescription?: string;
  createdAt?: Date;
  updatedAt?: string;
  uptd_Usr_Cd?: string;
}

const DB_NAME = process.env.DB_NAME || "my-next-app";

export async function getJobsFromMongo(
  url: URL,
  skip: number,
  limit: number,
  page: number
) {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  const dataCollection = db.collection<Job>("mockData");

  const recognitionStatus = url.searchParams.get("recognitionStatus") || "";
  const reviewStatus = url.searchParams.get("reviewStatus") || "";
  const reviewByStatus = url.searchParams.get("reviewByStatus") || "";
  const breakdownReason = url.searchParams.get("breakdownReason") || "";
  const uptd_Usr_Cd = url.searchParams.get("uptd_Usr_Cd") || "";

  let podDate = url.searchParams.get("podDate") || "";
  const createdDate = url.searchParams.get("createdDate") || "";

  const fileName = url.searchParams.get("fileName") || "";
  const podDateSignature = url.searchParams.get("podDateSignature") || "";
  const bolNumber = url.searchParams.get("bolNumber") || "";
  const jobName = url.searchParams.get("jobName") || "";
  const fileId = url.searchParams.get("fileId") || "";
  const searchQuery = url.searchParams.get("search") || "";
  const filter: Filter<Job> = {};
  const sortColumnsString = url.searchParams.get("sortColumn");
  const sortColumns = sortColumnsString ? sortColumnsString.split(",") : [];
  const sortOrderString = url.searchParams.get("sortOrder") || "asc";
  const sortOrders = sortOrderString.split(",");

  const sortQuery: Record<string, 1 | -1> = {};

  sortColumns.forEach((column, index) => {
    const order = sortOrders[index] === "desc" ? -1 : 1;
    sortQuery[column] = order;
  });

  if (sortOrders.length < sortColumns.length) {
    for (let i = sortOrders.length; i < sortColumns.length; i++) {
      sortQuery[sortColumns[i]] = 1;
    }
  }

  if (podDateSignature) {
    filter.podSignature = { $regex: podDateSignature.trim(), $options: "i" };
  }

  if (bolNumber) {
    if (/^\d+$/.test(bolNumber)) {
      filter.blNumber = parseInt(bolNumber, 10);
    } else {
      filter.blNumber = { $regex: bolNumber.trim(), $options: "i" };
    }
  }

  if (jobName) {
    filter.jobName = { $regex: jobName.trim(), $options: "i" };
  }

  if (fileId) {
    filter.fileId = { $regex: fileId.trim(), $options: "i" };
  }

  if (uptd_Usr_Cd.trim()) {
    filter.uptd_Usr_Cd = { $regex: uptd_Usr_Cd.trim(), $options: "i" };
  } else {
    filter.uptd_Usr_Cd = "";
  }

  if (searchQuery) {
    const searchRegex = { $regex: searchQuery, $options: "i" };
    filter.$or = [
      { blNumber: searchRegex },
      { jobName: searchRegex },
      { podSignature: searchRegex },
    ];
  }

  if (recognitionStatus) filter.recognitionStatus = recognitionStatus;
  if (reviewStatus) filter.reviewStatus = reviewStatus;
  if (reviewByStatus) filter.reviewedBy = reviewByStatus;
  if (breakdownReason) filter.breakdownReason = breakdownReason;

  if (podDate) {
    try {
      const parsedDate = parse(podDate, "yyyy-MM-dd", new Date());
      podDate = format(parsedDate, "MM/dd/yy");
      filter.podDate = podDate;
    } catch (error) {
      console.log("Invalid podDate format:", error);
    }
  }
  let createdAt;

  if (createdDate) {
    const parsed = new Date(createdDate);
    if (!isNaN(parsed.getTime())) {
      createdAt = parsed;
    }
  }
  if (createdAt) {
    const nextDay = new Date(createdAt);
    nextDay.setDate(nextDay.getDate() + 1);

    filter.createdAt = {
      $gte: createdAt,
      $lt: nextDay,
    };
  }
  if (fileName) {
    const fileNameRegex = new RegExp(fileName.trim(), "i");
    filter.pdfUrl = { $regex: fileNameRegex };
  }

  const jobs = await dataCollection
    .find(filter)
    .sort(sortQuery)
    .skip(skip)
    .limit(limit)
    .toArray();
  const totalJobs = await dataCollection.countDocuments(filter);

  return NextResponse.json(
    { jobs, totalJobs, page, totalPages: Math.ceil(totalJobs / limit) },
    { status: 200 }
  );
}
