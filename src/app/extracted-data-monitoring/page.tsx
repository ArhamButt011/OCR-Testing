"use client";

import { useState, useEffect, useCallback, useRef } from "react";
// import { motion } from "framer-motion";
import { useSidebar } from "../context/SidebarContext";
import { useRouter } from "next/navigation";
import Sidebar from "../components/Sidebar";
import Spinner from "../components/Spinner";
import Header from "../components/Header";
import Link from "next/link";
import { IoIosArrowForward } from "react-icons/io";
// import { IoIosInformationCircle } from "react-icons/io";
import { RiArrowDropDownLine } from "react-icons/ri";
import { MdDelete } from "react-icons/md";
import { GiShare } from "react-icons/gi";
import { FiSearch } from "react-icons/fi";
import { FaChevronDown } from "react-icons/fa";
import { IoCalendar } from "react-icons/io5";
import Swal from "sweetalert2";
import Tippy from "@tippyjs/react";
import { Instance } from "tippy.js";
import "tippy.js/dist/tippy.css";
import TableSpinner from "../components/TableSpinner";
import UploadModal from "../components/UploadModal";
import { FiUpload } from "react-icons/fi";
import FileNameCell from "../components/UI/FileNameCell";
import axios from "axios";
import TruncatedCell from "../components/UI/TrucatedCell";

type FinalStatus =
  | "new"
  | "inProgress"
  | "valid"
  | "partiallyValid"
  | "failure"
  | "sent";
type ReviewStatus = "unConfirmed" | "confirmed" | "denied" | "deleted";
type RecognitionStatus =
  | "new"
  | "inProgress"
  | "valid"
  | "partiallyValid"
  | "failure"
  | "sent";
type BreakdownReason = "none" | "damaged" | "shortage" | "overage" | "refused";
type StatusCounts = {
  updated: number;
  notFound: number;
  added: number;
};

type ResultItem = {
  status: "updated" | "not_found" | "added";
  // other fields if any...
};

interface Job {
  _id: string;
  fileId?: string;
  fileName?: string;
  blNumber: string;
  pdfUrl?: string;
  jobName: string;
  podDate: string;
  deliveryDate: Date;
  podSignature: string;
  totalQty: number;
  received: number;
  damaged: number;
  short: number;
  over: number;
  refused: number;
  noOfPages: number;
  stampExists: string;
  finalStatus: FinalStatus;
  reviewStatus: ReviewStatus;
  recognitionStatus: RecognitionStatus;
  breakdownReason: BreakdownReason;
  reviewedBy: string;
  sealIntact: string;
  cargoDescription: string;
  createdAt: string;
  updatedAt?: string;
  customerOrderNum?: string | string[] | null;
}

interface OcrJob {
  _id: string;
  B_L_Number: string;
  Signature_Exists: string;
  Issued_Qty: number;
  Received_Qty: number;
  Damage_Qty: number;
  Short_Qty: number;
  Over_Qty: number;
  Refused_Qty: number;
  POD_Date: string;
  Seal_Intact: string;
  Stamp_Exists: string;
  Customer_Order_Num?: string;
}

type LogEntry = {
  fileName: string;
  status: string;
  connectionResult?: string;
  logDescription?: string;
  message?: string;
};

const options = [
  { value: "blNumber", label: "BL Number" },
  { value: "jobName", label: "Job Name" },
  { value: "podDate", label: "POD Date" },
  { value: "podSignature", label: "Signature Exists" },
  { value: "totalQty", label: "Issued Qty" },
  { value: "received", label: "Received Qty" },
  { value: "damaged", label: "Damaged Qty" },
  { value: "short", label: "Short Qty" },
  { value: "over", label: "Over Qty" },
  { value: "refused", label: "Refused Qty" },
  { value: "customerOrderNum", label: "Customer Order Num" },
  { value: "stampExists", label: "Stamp Exists" },
  { value: "sealIntact", label: "Seal Intact" },
  { value: "finalStatus", label: "Final Status" },
  { value: "reviewStatus", label: "Review Status" },
  { value: "recognitionStatus", label: "Recognition Status" },
  { value: "breakdownReason", label: "Breakdown Reason" },
  { value: "reviewedBy", label: "Reviewed By" },
];

const MasterPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [master, setMaster] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showButton, setShowButton] = useState(false);
  const [name, setName] = useState("");
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [finalStatusFilter, setFinalStatusFilter] = useState("");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("");
  const [reasonStatusFilter, setReasonStatusFilter] = useState("");
  const [uptd_Usr_Cd, setUptd_Usr_Cd] = useState("OCR");
  const [reviewByStatusFilter, setReviewByStatusFilter] = useState("");
  const [podDateFilter, setPodDateFilter] = useState("");
  const [createdDateFilter, setCreatedDateFilter] = useState("");
  const [updatedDateFilter, setUpdatedDateFilter] = useState("");
  const [podDateSignatureFilter, setPodDateSignatureFilter] = useState("");
  const [jobNameFilter, setJobNameFilter] = useState("");
  const [fileNameFilter, setFileNameFilter] = useState("");
  const [fileIdFilter, setFileIdFilter] = useState("");
  const [bolNumberFilter, setBolNumberFilter] = useState("");
  const [dropdownStates, setDropdownStates] = useState<string | null>(null);
  const [dropdownStatesFirst, setDropdownStatesFirst] = useState<string | null>(
    null
  );

  const [dropdownStatesSecond, setDropdownStatesSecond] = useState<
    string | null
  >(null);
  const [dropdownStatesThird, setDropdownStatesThird] = useState<string | null>(
    null
  );
  const parentRefFinal = useRef<Instance | null>(null);
  const parentRefReview = useRef<Instance | null>(null);
  const parentRefRecognition = useRef<Instance | null>(null);
  const parentRefBreakdown = useRef<Instance | null>(null);
  const [firstTime, setFirstTime] = useState(false);
  // const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [abortController, setAbortController] = useState(new AbortController());
  const [ocrApiUrl, setOcrApiUrl] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [db, setDb] = useState<string>();

  const finalOptions = [
    { status: "new", color: "text-blue-600", bgColor: "bg-blue-100" },
    {
      status: "inProgress",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    { status: "valid", color: "text-green-600", bgColor: "bg-green-100" },
    {
      status: "partiallyValid",
      color: "text-[#AF9918]",
      bgColor: "bg-[#faf1be]",
    },
    { status: "failure", color: "text-red-600", bgColor: "bg-red-100" },
    { status: "sent", color: "text-green-600", bgColor: "bg-green-100" },
  ];
  const reviewOptions = [
    {
      status: "unConfirmed",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    { status: "confirmed", color: "text-green-600", bgColor: "bg-green-100" },
    { status: "deleted", color: "text-red-600", bgColor: "bg-red-100" },
    { status: "denied", color: "text-[#AF9918]", bgColor: "bg-[#faf1be]" },
  ];
  const recognitionOptions = [
    { status: "new", color: "text-blue-600", bgColor: "bg-blue-100" },
    {
      status: "inProgress",
      color: "text-yellow-600",
      bgColor: "bg-yellow-100",
    },
    { status: "valid", color: "text-green-600", bgColor: "bg-green-100" },
    {
      status: "partiallyValid",
      color: "text-[#AF9918]",
      bgColor: "bg-[#faf1be]",
    },
    { status: "failure", color: "text-red-600", bgColor: "bg-red-100" },
    { status: "sent", color: "text-green-600", bgColor: "bg-green-100" },
  ];
  const breakdownOptions = [
    { status: "none", color: "text-blue-600", bgColor: "bg-blue-100" },
    { status: "damaged", color: "text-yellow-600", bgColor: "bg-yellow-100" },
    { status: "shortage", color: "text-green-600", bgColor: "bg-green-100" },
    { status: "overage", color: "text-[#AF9918]", bgColor: "bg-[#faf1be]" },
    { status: "refused", color: "text-red-600", bgColor: "bg-red-100" },
  ];
  const isAnyFilterApplied = () => {
    return (
      sessionStorage.getItem("finalStatusFilter") ||
      sessionStorage.getItem("reviewStatusFilter") ||
      sessionStorage.getItem("reasonStatusFilter") ||
      sessionStorage.getItem("reviewByStatusFilter") ||
      sessionStorage.getItem("uptd_Usr_Cd") ||
      sessionStorage.getItem("podDateFilter") ||
      sessionStorage.getItem("createdDateFilter") ||
      sessionStorage.getItem("updatedDateFilter") ||
      sessionStorage.getItem("podDateSignatureFilter") ||
      sessionStorage.getItem("jobNameFilter") ||
      sessionStorage.getItem("fileNameFilter") ||
      sessionStorage.getItem("fileIdFilter") ||
      sessionStorage.getItem("bolNumberFilter")
    );
  };

  useEffect(() => {
    const fetchDBType = async () => {
      const dbRes = await axios.get("/api/oracle/connection-status");
      setDb(dbRes.data.dataBase);
    };
    fetchDBType();
  }, [db]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (localStorage.getItem("prev") === "") {
        setFirstTime(true);
        setFinalStatusFilter(sessionStorage.getItem("finalStatusFilter") || "");
        setReviewStatusFilter(
          sessionStorage.getItem("reviewStatusFilter") || ""
        );
        setReasonStatusFilter(
          sessionStorage.getItem("reasonStatusFilter") || ""
        );

        setReviewByStatusFilter(
          sessionStorage.getItem("reviewByStatusFilter") || ""
        );
        setUptd_Usr_Cd(sessionStorage.getItem("uptd_Usr_Cd") || "OCR");
        setPodDateFilter(sessionStorage.getItem("podDateFilter") || "");
        setCreatedDateFilter(sessionStorage.getItem("createdDateFilter") || "");
        setUpdatedDateFilter(sessionStorage.getItem("updatedDateFilter") || "");
        setPodDateSignatureFilter(
          sessionStorage.getItem("podDateSignatureFilter") || ""
        );
        setJobNameFilter(sessionStorage.getItem("jobNameFilter") || "");
        setFileNameFilter(sessionStorage.getItem("fileNameFilter") || "");
        setFileIdFilter(sessionStorage.getItem("fileIdFilter") || "");
        setBolNumberFilter(sessionStorage.getItem("bolNumberFilter") || "");
      } else {
        sessionStorage.setItem("finalStatusFilter", "");
        sessionStorage.setItem("reviewStatusFilter", "");
        sessionStorage.setItem("reasonStatusFilter", "");
        sessionStorage.setItem("reviewByStatusFilter", "");
        sessionStorage.setItem("uptd_Usr_Cd", "OCR");
        sessionStorage.setItem("podDateFilter", "");
        sessionStorage.setItem("createdDateFilter", "");
        sessionStorage.setItem("updatedDateFilter", "");

        sessionStorage.setItem("podDateSignatureFilter", "");
        sessionStorage.setItem("jobNameFilter", "");
        sessionStorage.setItem("fileNameFilter", "");
        sessionStorage.setItem("fileIdFilter", "");
        sessionStorage.setItem("bolNumberFilter", "");
        setFinalStatusFilter("");
        setReviewStatusFilter("");
        setReasonStatusFilter("");
        setUptd_Usr_Cd("OCR");
        setReviewByStatusFilter("");
        setPodDateFilter("");
        setCreatedDateFilter("");
        setUpdatedDateFilter("");
        setPodDateSignatureFilter("");
        setJobNameFilter("");
        setFileNameFilter("");
        setFileIdFilter("");
        setBolNumberFilter("");
        setFirstTime(false);
      }
    }
  }, []);

  const { isExpanded } = useSidebar();

  const handleSidebarStateChange = (newState: boolean) => {
    return newState;
    // console.log("Sidebar state changed:", newState);
    // setIsSidebarExpanded(newState);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    const decodeJwt = (token: string) => {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );

      return JSON.parse(jsonPayload);
    };

    const decodedToken = decodeJwt(token);
    const currentTime = Date.now() / 1000;

    setUserRole(decodedToken.role);

    if (userRole === "admin") {
      setName("Admin");
    } else {
      setName(decodedToken.username);
    }

    if (userRole === "admin") {
      if (decodedToken.exp < currentTime) {
        localStorage.removeItem("token");
        router.push("/admin-login");
        return;
      }
    } else {
      if (decodedToken.exp < currentTime) {
        localStorage.removeItem("token");
        router.push("/login");
        return;
      }
    }

    setIsAuthenticated(true);
    setLoading(false);
  }, [router, userRole]);

  const handleRowSelection = (id: string) => {
    setSelectedRows((prevSelectedRows) =>
      prevSelectedRows.includes(id)
        ? prevSelectedRows.filter((rowId) => rowId !== id)
        : [...prevSelectedRows, id]
    );
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch("/api/jobs/ocr", { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        setIsOcrRunning(data.status === "start");
      } catch (error) {
        console.error("Error fetching OCR status:", error);
      }
    };

    fetchStatus();

    const interval = setInterval(fetchStatus, 50000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchOcrApiUrl() {
      try {
        const res = await fetch("/api/ipAddress/ip-address", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json();

        if (data.ip) {
          setOcrApiUrl(`http://${data.ip}:8080/run-ocr`);
          // setOcrApiUrl(`https://pj7kx03k4bklhr-8080.proxy.runpod.net/docs`);
          setBaseUrl(`http://${data.secondaryIp}:3000`);
        }
      } catch (error) {
        console.error("Failed to fetch OCR API URL:", error);
      }
    }

    fetchOcrApiUrl();
  }, []);
  const pdfFiles = selectedRows
    .map((rowId) => {
      const job = master.find((job) => {
        return job._id === rowId;
      });
      console.log("job-> ", job);
      if (
        (job && (!job.blNumber || !job.podSignature?.trim()) && job.pdfUrl) ||
        job?.fileName
      ) {
        let fileName: string | undefined | number;

        if (job.pdfUrl) {
          fileName = job.pdfUrl.split("/").pop() || "";
        } else {
          fileName = job?.fileName;
        }
        if (!fileName) return null;
        return {
          file_url_or_path: `${baseUrl}/api/access-file?filename=${encodeURIComponent(
            fileName
          )}`,
          _id: job?._id,
        };
      }

      return null;
    })
    .filter(Boolean);

  console.log("pdfFiles-> ", pdfFiles);

  const mergeOcrDataIntoMaster = (ocrData: OcrJob[]) => {
    setMaster((prevMaster) => {
      const updated = prevMaster.map((item) => {
        const ocrItem = ocrData.find((ocr) => ocr._id === item._id);

        if (!ocrItem) return item;

        const updatedItem = {
          ...item,
          blNumber: ocrItem.B_L_Number,
          fileId: ocrItem._id,
          podSignature: ocrItem.Signature_Exists,
          totalQty: ocrItem.Issued_Qty,
          received: ocrItem.Received_Qty,
          damaged: ocrItem.Damage_Qty,
          short: ocrItem.Short_Qty,
          over: ocrItem.Over_Qty,
          refused: ocrItem.Refused_Qty,
          podDate: ocrItem.POD_Date,
          createdAt: new Date().toISOString(),
          sealIntact: ocrItem.Seal_Intact === "yes" ? "Y" : "N",
          stampExists: ocrItem.Stamp_Exists,
          reviewedBy: "OCR Engine",
        };

        console.log("🔄 merging item:", item._id, "->", updatedItem);

        return updatedItem;
      });

      console.log("✅ updated master before setMaster:", updated);
      return updated;
    });
  };

  const handleOcrToggle = async () => {
    // if (selectedRows.length === 0 && !isOcrRunning) return;
    if (!ocrApiUrl) {
      Swal.fire({
        icon: "warning",
        title: "IP Address Missing",
        text: "Please provide the IP Address in the settings before starting the process.",
        confirmButtonColor: "#005B97",
      });
      return;
    }

    if (pdfFiles.length === 0 && !isOcrRunning) return;

    const newStatus = isOcrRunning ? "stop" : "start";

    const statusResponse = await fetch("/api/jobs/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });

    const statusData = await statusResponse.json();
    if (!statusResponse.ok) {
      console.error("Error:", statusData.message);
      return;
    }

    if (newStatus === "stop") {
      abortController.abort();
      setAbortController(new AbortController());
      setIsOcrRunning(false);
      setSelectedRows([]);
      setProgress({});
      fetchJobs();
      setIsProcessModalOpen(false);
      return;
    }

    setIsOcrRunning(true);
    setIsProcessModalOpen(true);
    setProgress({});

    // async function processPdfsSequentially() {
    //   for (const pdfFile of pdfFiles) {
    //     if (!pdfFile?.file_url_or_path) continue;
    //     const filePath = pdfFile.file_url_or_path;
    //     const fileId = pdfFile._id;

    //     setProgress((prev) => ({
    //       ...prev,
    //       [filePath]: 10,
    //     }));

    //     try {
    //       const ocrResponse = await fetch(ocrApiUrl, {
    //         method: "POST",
    //         headers: { "Content-Type": "application/json" },
    //         body: JSON.stringify({
    //           _id: fileId,
    //           file_url_or_path: filePath,
    //         }),
    //         signal: abortController.signal,
    //       });

    //       if (!ocrResponse.ok) {
    //         const errorData = await ocrResponse.json().catch(() => null);
    //         throw new Error(errorData?.error || "Failed to process OCR");
    //       }
    //       const ocrData = await ocrResponse.json();
    //       console.log("ocr dtaa-> ", ocrData);

    //       if (ocrData && Array.isArray(ocrData)) {
    //         if (db === "remote") {
    //           mergeOcrDataIntoMaster(ocrData);
    //         }
    //         const processedDataArray = ocrData.map((data) => {
    //           const recognitionStatusMap: Record<
    //             "failed" | "partially valid" | "valid" | "null",
    //             string
    //           > = {
    //             failed: "failure",
    //             "partially valid": "partiallyValid",
    //             valid: "valid",
    //             null: "null",
    //           };
    //           const status =
    //             (data?.Status as keyof typeof recognitionStatusMap) || "null";
    //           const recognitionStatus = recognitionStatusMap[status] || "null";

    //           const urlObj = new URL(filePath);
    //           const filename = urlObj.searchParams.get("filename") || "";
    //           const decodedFilePath = `/file/${decodeURIComponent(filename)}`;

    //           return {
    //             jobId: null,
    //             pdfUrl: decodedFilePath,
    //             fileId: data?._id,
    //             deliveryDate: new Date().toISOString().split("T")[0],
    //             noOfPages: 1,
    //             blNumber: data?.B_L_Number || "",
    //             podDate: data?.POD_Date || "",
    //             podSignature:
    //               data?.Signature_Exists === "yes"
    //                 ? "yes"
    //                 : data?.Signature_Exists === "no"
    //                 ? "no"
    //                 : data?.Signature_Exists,
    //             totalQty: isNaN(data?.Issued_Qty)
    //               ? data?.Issued_Qty
    //               : Number(data?.Issued_Qty),
    //             received: data?.Received_Qty,
    //             damaged: data?.Damage_Qty,
    //             short: data?.Short_Qty,
    //             over: data?.Over_Qty,
    //             refused: data?.Refused_Qty,
    //             customerOrderNum: data?.Customer_Order_Num,
    //             stampExists:
    //               data?.Stamp_Exists === "yes"
    //                 ? "yes"
    //                 : data?.Stamp_Exists === "no"
    //                 ? "no"
    //                 : data?.Stamp_Exists,
    //             uptd_Usr_Cd: "OCR",
    //             finalStatus: "valid",
    //             reviewStatus: "unConfirmed",
    //             recognitionStatus: recognitionStatus,
    //             breakdownReason: "none",
    //             reviewedBy: "OCR Engine",
    //             cargoDescription: "Processed from OCR API.",
    //             sealIntact:
    //               data?.Seal_Intact === "yes"
    //                 ? "Y"
    //                 : data?.Seal_Intact === "no"
    //                 ? "N"
    //                 : data?.Seal_Intact,
    //           };
    //         });

    //         const saveResponse = await fetch("/api/process-data/save-data", {
    //           method: "POST",
    //           headers: { "Content-Type": "application/json" },
    //           body: JSON.stringify(processedDataArray),
    //         });
    //         // const data = await saveResponse.json();

    //         if (!saveResponse.ok) {
    //           console.error("Error saving data:", await saveResponse.json());
    //         } else {
    //           // console.log("OCR data saved successfully.");
    //         }
    //       }

    //       let progressValue = 1;

    //       while (progressValue < 100) {
    //         await new Promise((resolve) => setTimeout(resolve, 1000));
    //         progressValue += 25;
    //         setProgress((prev) => ({
    //           ...prev,
    //           [filePath]: progressValue,
    //         }));
    //       }

    //       setProgress((prev) => ({ ...prev, [filePath]: 100 }));
    //     } catch (error: unknown) {
    //       if (error instanceof Error) {
    //         if (error.name === "AbortError") {
    //           // console.log(`OCR request was aborted for: ${filePath}`);
    //           return;
    //         }
    //         console.error(`Error processing ${filePath}:`, error);
    //       } else {
    //         console.error(`Unexpected error processing ${filePath}:`, error);
    //       }

    //       setProgress((prev) => ({
    //         ...prev,
    //         [filePath]: 1,
    //       }));
    //     }
    //   }

    //   const newStatus = "stop";
    //   await fetch("/api/jobs/ocr", {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({ status: newStatus }),
    //   });

    //   setIsOcrRunning(false);
    //   setIsProcessModalOpen(false);
    //   setSelectedRows([]);
    //   setProgress({});
    //   if (db !== "remote") {
    //     fetchJobs();
    //   }
    // }
    async function processPdfsSequentially() {
      const batchSize = 4;

      for (let i = 0; i < pdfFiles.length; i += batchSize) {
        const batch = pdfFiles
          .slice(i, i + batchSize)
          .filter(
            (f): f is { file_url_or_path: string; _id: string } => f !== null
          );
        console.log("Processing batch:", batch);
        // Set initial progress
        batch.forEach((pdfFile) => {
          if (!pdfFile || !pdfFile.file_url_or_path) return;

          setProgress((prev) => ({
            ...prev,
            [pdfFile.file_url_or_path]: 10,
          }));
        });

        try {
          const payload = batch.map((pdfFile) => ({
            _id: pdfFile._id,
            file_url_or_path: pdfFile.file_url_or_path,
          }));

          const ocrResponse = await fetch(ocrApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: abortController.signal,
          });

          if (!ocrResponse.ok) {
            const errorData = await ocrResponse.json().catch(() => null);
            throw new Error(errorData?.error || "Failed to process OCR");
          }

          const ocrData = await ocrResponse.json();
          console.log("OCR data received:", ocrData);

          if (ocrData && Array.isArray(ocrData)) {
            if (db === "remote") {
              mergeOcrDataIntoMaster(ocrData);
            }

            const processedDataArray = ocrData.map((data) => {
              const recognitionStatusMap: Record<
                "failed" | "partially valid" | "valid" | "null",
                string
              > = {
                failed: "failure",
                "partially valid": "partiallyValid",
                valid: "valid",
                null: "null",
              };
              const status =
                (data?.Status as keyof typeof recognitionStatusMap) || "null";
              const recognitionStatus = recognitionStatusMap[status] || "null";

              const matchingFile = batch.find((f) => f._id === data?._id);
              const urlObj = new URL(matchingFile?.file_url_or_path || "");
              const filename = urlObj.searchParams.get("filename") || "";
              const decodedFilePath = `/file/${decodeURIComponent(filename)}`;

              return {
                jobId: null,
                pdfUrl: decodedFilePath,
                fileId: data?._id,
                deliveryDate: new Date().toISOString().split("T")[0],
                noOfPages: 1,
                blNumber: data?.B_L_Number || "",
                podDate: data?.POD_Date || "",
                podSignature:
                  data?.Signature_Exists === "yes"
                    ? "yes"
                    : data?.Signature_Exists === "no"
                    ? "no"
                    : data?.Signature_Exists,
                totalQty: isNaN(data?.Issued_Qty)
                  ? data?.Issued_Qty
                  : Number(data?.Issued_Qty),
                received: data?.Received_Qty,
                damaged: data?.Damage_Qty,
                short: data?.Short_Qty,
                over: data?.Over_Qty,
                refused: data?.Refused_Qty,
                customerOrderNum: data?.Customer_Order_Num,
                stampExists:
                  data?.Stamp_Exists === "yes"
                    ? "yes"
                    : data?.Stamp_Exists === "no"
                    ? "no"
                    : data?.Stamp_Exists,
                uptd_Usr_Cd: "OCR",
                finalStatus: "valid",
                reviewStatus: "unConfirmed",
                recognitionStatus: recognitionStatus,
                breakdownReason: "none",
                reviewedBy: "OCR Engine",
                cargoDescription: "Processed from OCR API.",
                sealIntact:
                  data?.Seal_Intact === "yes"
                    ? "Y"
                    : data?.Seal_Intact === "no"
                    ? "N"
                    : data?.Seal_Intact,
              };
            });

            const saveResponse = await fetch("/api/process-data/save-data", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(processedDataArray),
            });

            if (!saveResponse.ok) {
              console.error("Error saving data:", await saveResponse.json());
            }
          }

          // Simulate progress update
          for (let p = 25; p <= 100; p += 25) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            batch.forEach((pdfFile) => {
              setProgress((prev) => ({
                ...prev,
                [pdfFile.file_url_or_path]: p,
              }));
            });
          }
        } catch (error) {
          batch.forEach((pdfFile) => {
            setProgress((prev) => ({
              ...prev,
              [pdfFile.file_url_or_path]: 1,
            }));
          });

          if (error instanceof Error && error.name === "AbortError") {
            return;
          }

          console.error("OCR batch error:", error);
        }
      }

      // Stop OCR at the end
      await fetch("/api/jobs/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "stop" }),
      });

      setIsOcrRunning(false);
      setIsProcessModalOpen(false);
      setSelectedRows([]);
      setProgress({});
      if (db !== "remote") {
        fetchJobs();
      }
    }

    await processPdfsSequentially();
  };
  useEffect(() => {
    console.log("✅ Master updated:", master);
  }, [master]);

  const handleSelectAll = () => {
    if (selectedRows.length === master.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(master.map((job) => job._id));
    }
  };

  const isAllSelected =
    selectedRows.length === master.length && master.length > 0;

  const capitalizeFirstLetter = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const updateStatus = async (
    id: string,
    field: string,
    value: string,
    reviewedBy: string
  ): Promise<void> => {
    const formattedReviewedBy = capitalizeFirstLetter(reviewedBy);

    try {
      const res = await fetch(`/api/process-data/update-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          field,
          value,
          reviewedBy: formattedReviewedBy,
        }),
      });

      if (res.ok) {
        setMaster((prevJobs) =>
          prevJobs.map((job) =>
            job._id === id
              ? { ...job, [field]: value, reviewedBy: formattedReviewedBy }
              : job
          )
        );

        Swal.fire({
          icon: "success",
          title: "Status Updated",
          text: `The status has been updated to ${value}.`,
          timer: 2000,
          showConfirmButton: false,
        });
      } else {
        const errorData = await res.json();
        console.log(
          `Failed to update status: ${errorData.message || "Unknown error"}`
        );
      }
    } catch (error) {
      console.log("Error updating status:", error);
    }
  };
  const handleDelete = async () => {
    Swal.fire({
      title: "Delete Files",
      text: "Are you sure you want to delete these files?",
      icon: "warning",
      iconColor: "#005B97",
      showCancelButton: true,
      confirmButtonColor: "#005B97",
      cancelButtonColor: "#E0E0E0",
      confirmButtonText: "Delete",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch("/api/process-data/delete-rows", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: selectedRows }),
          });

          const result = await response.json();

          if (response.ok) {
            const isLastPage =
              master.length === selectedRows.length && currentPage > 1;
            if (isLastPage) {
              setCurrentPage((prevPage) => prevPage - 1);
            }

            await fetchJobs();
            setTotalJobs(totalJobs - selectedRows.length);
            setSelectedRows([]);
            Swal.fire({
              title: "Deleted!",
              text: "Your files have been deleted.",
              icon: "success",
              timer: 2000,
              showConfirmButton: false,
            });
          } else {
            Swal.fire({
              title: "Error!",
              text: result.error || "Failed to delete files.",
              icon: "error",
            });
          }
        } catch (error) {
          console.log("Error deleting files:", error);
          Swal.fire({
            title: "Error!",
            text: "Failed to delete files due to a network or server error.",
            icon: "error",
          });
        }
      }
    });
  };

  const handleSortColumnChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { value, checked } = event.target;

    setFirstTime(true);

    setSortColumn((prevSortColumns) => {
      const updatedSortColumns = checked
        ? [...prevSortColumns, value]
        : prevSortColumns.filter((col) => col !== value);

      return updatedSortColumns;
    });
  };

  useEffect(() => {
    if (firstTime) {
      fetchJobs();
      setFirstTime(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortColumn, sortOrder]);

  const fetchJobs = useCallback(async () => {
    try {
      setLoadingTable(true);
      const filters = {
        bolNumber: sessionStorage.getItem("bolNumberFilter") || "",
        finalStatus: sessionStorage.getItem("finalStatusFilter") || "",
        reviewStatus: sessionStorage.getItem("reviewStatusFilter") || "",
        reasonStatus: sessionStorage.getItem("reasonStatusFilter") || "",
        reviewByStatus: sessionStorage.getItem("reviewByStatusFilter") || "",
        uptd_Usr_Cd: sessionStorage.getItem("uptd_Usr_Cd") || "",
        podDate: sessionStorage.getItem("podDateFilter") || "",
        createdDate: sessionStorage.getItem("createdDateFilter") || "",
        updatedDate: sessionStorage.getItem("updatedDateFilter") || "",
        podDateSignature:
          sessionStorage.getItem("podDateSignatureFilter") || "",
        jobName: sessionStorage.getItem("jobNameFilter") || "",
        fileName: sessionStorage.getItem("fileNameFilter") || "",
        fileId: sessionStorage.getItem("fileIdFilter") || "",
        sortColumn,
        sortOrder,
      };

      const queryParams = new URLSearchParams();
      queryParams.set("page", currentPage.toString());

      if (filters.bolNumber) queryParams.set("bolNumber", filters.bolNumber);
      if (filters.finalStatus)
        queryParams.set("recognitionStatus", filters.finalStatus);
      if (filters.reviewStatus)
        queryParams.set("reviewStatus", filters.reviewStatus);
      if (filters.reasonStatus)
        queryParams.set("breakdownReason", filters.reasonStatus);
      if (filters.uptd_Usr_Cd)
        queryParams.set("uptd_Usr_Cd", filters.uptd_Usr_Cd);
      if (filters.podDate) queryParams.set("podDate", filters.podDate);
      if (filters.updatedDate)
        queryParams.set("updatedDate", filters.updatedDate);
      if (filters.createdDate)
        queryParams.set("createdDate", filters.createdDate);
      if (filters.podDateSignature)
        queryParams.set("podDateSignature", filters.podDateSignature.trim());
      if (filters.jobName) queryParams.set("jobName", filters.jobName.trim());
      if (filters.fileName)
        queryParams.set("fileName", filters.fileName.trim());
      if (filters.fileId) queryParams.set("fileId", filters.fileId.trim());
      if (filters.sortColumn.length) {
        queryParams.set("sortColumn", filters.sortColumn.join(","));
      }

      if (filters.sortOrder) {
        let sortOrders = Array.isArray(filters.sortOrder)
          ? filters.sortOrder
          : [filters.sortOrder];

        if (sortOrders.length === 1 && filters.sortColumn.length > 1) {
          sortOrders = new Array(filters.sortColumn.length).fill(sortOrders[0]);
        }

        queryParams.set("sortOrder", sortOrders.join(","));
      }
      const response = await fetch(
        `/api/process-data/get-data/?${queryParams.toString()}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Failed to fetch jobs:", errorText);
        return;
      }

      const data = await response.json();
      setMaster(data.jobs);
      console.log("extracted data-> ", data);
      setTotalPages(data.totalPages);
      setTotalJobs(data.totalJobs);
    } catch (error) {
      console.log("Error fetching jobs:", error);
    } finally {
      setLoadingTable(false);
    }
  }, [currentPage, sortColumn, sortOrder]);

  useEffect(() => {
    if (firstTime) {
      fetchJobs();
      setFirstTime(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, firstTime, sortColumn, sortOrder]);

  const handleFilterApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sessionStorage.setItem("finalStatusFilter", finalStatusFilter);
    sessionStorage.setItem("reviewStatusFilter", reviewStatusFilter);
    sessionStorage.setItem("reasonStatusFilter", reasonStatusFilter);
    sessionStorage.setItem("reviewByStatusFilter", reviewByStatusFilter);
    sessionStorage.setItem("uptd_Usr_Cd", uptd_Usr_Cd);
    sessionStorage.setItem("podDateFilter", podDateFilter);
    sessionStorage.setItem("createdDateFilter", createdDateFilter);
    sessionStorage.setItem("updatedDateFilter", updatedDateFilter);

    sessionStorage.setItem("podDateSignatureFilter", podDateSignatureFilter);
    sessionStorage.setItem("jobNameFilter", jobNameFilter);
    sessionStorage.setItem("fileNameFilter", fileNameFilter);
    sessionStorage.setItem("fileIdFilter", fileIdFilter);
    sessionStorage.setItem("bolNumberFilter", bolNumberFilter);
    fetchJobs();
  };

  const resetFiltersAndFetch = async () => {
    sessionStorage.setItem("finalStatusFilter", "");
    sessionStorage.setItem("reviewStatusFilter", "");
    sessionStorage.setItem("reasonStatusFilter", "");
    sessionStorage.setItem("reviewByStatusFilter", "");
    sessionStorage.setItem("uptd_Usr_Cd", "OCR");
    sessionStorage.setItem("podDateFilter", "");
    sessionStorage.setItem("createdDateFilter", "");
    sessionStorage.setItem("updatedDateFilter", "");
    sessionStorage.setItem("podDateSignatureFilter", "");
    sessionStorage.setItem("jobNameFilter", "");
    sessionStorage.setItem("fileNameFilter", "");
    sessionStorage.setItem("fileIdFilter", "");
    sessionStorage.setItem("bolNumberFilter", "");
    setFinalStatusFilter("");
    setReviewStatusFilter("");
    setReasonStatusFilter("");
    setUptd_Usr_Cd("OCR");
    setReviewByStatusFilter("");
    setPodDateFilter("");
    setCreatedDateFilter("");
    setUpdatedDateFilter("");
    setPodDateSignatureFilter("");
    setJobNameFilter("");
    setFileNameFilter("");
    setFileIdFilter("");
    setBolNumberFilter("");
    setMaster([]);
    await fetchJobs();
  };

  const handleRouteChange = () => {
    if (typeof window !== "undefined") {
      const filters = {
        finalStatusFilter,
        reviewStatusFilter,
        reasonStatusFilter,
        reviewByStatusFilter,
        uptd_Usr_Cd,
        podDateFilter,
        createdDateFilter,
        updatedDateFilter,
        podDateSignatureFilter,
        jobNameFilter,
        fileNameFilter,
        fileIdFilter,
        bolNumberFilter,
      };
      Object.entries(filters).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    }
  };

  const handlePageChange = (newPage: number) => {
    setFirstTime(true);
    setCurrentPage(newPage);
  };

  const handleSortOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as "asc" | "desc";
    setSortOrder(value);
    setFirstTime(true);
  };

  const handleSend = async () => {
    Swal.fire({
      title: "Send Files",
      text: "Are you sure you want to send these files?",
      icon: "warning",
      iconColor: "#AF9918",
      showCancelButton: true,
      confirmButtonColor: "#AF9918",
      cancelButtonColor: "#E0E0E0",
      confirmButtonText: "Yes Sure!",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch("/api/process-data/update-rows", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: selectedRows, dbType: db }),
          });

          const result = await response.json();
          const resultArray = result?.logs?.map((data: LogEntry) => ({
            fileName: data.fileName,
            status: data.status,
          }));

          // Count the status occurrences
          const counts = resultArray?.reduce(
            (acc: StatusCounts, item: ResultItem) => {
              if (item.status === "updated") acc.updated++;
              else if (item.status === "not_found") acc.notFound++;
              else if (item.status === "added") acc.added++;
              return acc;
            },
            { updated: 0, notFound: 0, added: 0 }
          );

          // Build the summary HTML for counts
          const summaryHtml = `
  <p><strong>Summary:</strong></p>
  <p>Updated files: <strong>${counts.updated}</strong></p>
  <p>Added files: <strong>${counts.added}</strong></p>
  <p>Not found files: <strong>${counts.notFound}</strong></p>
  <p><a href="/logs" style="color:#3085d6; text-decoration: underline;">View Logs</a></p>
`;

          if (response.ok) {
            await fetchJobs();
            setSelectedRows([]);
            Swal.fire({
              title: "Sent!",
              html: summaryHtml,
              icon: "success",
              showConfirmButton: true,
            });
          } else {
            Swal.fire({
              title: "Error!",
              text: result.error || "Failed to send files.",
              icon: "error",
            });
          }
        } catch (error) {
          console.log("Error sending files:", error);
          Swal.fire({
            title: "Error!",
            text: "Failed to send files due to a network or server error.",
            icon: "error",
          });
        }
      }
    });
  };
  console.log("master data-> ", master);
  useEffect(() => {
    setShowButton(selectedRows.length > 0);
  }, [selectedRows]);

  useEffect(() => {
    if (!isProcessModalOpen) return;

    const preventRefresh = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const updateStatus = () => {
      const newStatus = "stop";
      const data = JSON.stringify({ status: newStatus });
      navigator.sendBeacon("/api/jobs/ocr", data);
    };

    window.addEventListener("beforeunload", preventRefresh);
    window.addEventListener("unload", updateStatus);

    return () => {
      window.removeEventListener("beforeunload", preventRefresh);
      window.removeEventListener("unload", updateStatus);
      updateStatus();
      setIsOcrRunning(false);
      setIsProcessModalOpen(false);
      setSelectedRows([]);
      setProgress({});
      if (db !== "remote") {
        fetchJobs();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProcessModalOpen]);

  const buttonColor = isOcrRunning
    ? "bg-red-600 border border-red-600"
    : "bg-[#005B97]";

  if (loading) return <Spinner />;
  if (!isAuthenticated) return <p>Access Denied. Redirecting...</p>;

  return (
    <div className="h-screen bg-white overflow-x-hidden max-w-screen">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          !isExpanded ? "ml-24" : "ml-64"
        }`}
      >
        <Header
          leftContent="Extracted Data Monitoring"
          totalContent={totalJobs}
          rightContent={
            <>
              <div className="flex gap-4 mr-3">
                {showButton && (
                  <>
                    <div
                      className="flex gap-2 group cursor-pointer transition-all duration-300"
                      onClick={handleDelete}
                    >
                      <span>
                        <MdDelete className="fill-[red] text-2xl transition-transform transform group-hover:scale-110 group-hover:duration-300" />
                      </span>
                      <span className="text-[red] transition-all duration-300 group-hover:text-red-600  group-hover:duration-300">
                        Delete
                      </span>
                    </div>

                    <div
                      className="flex gap-2 group cursor-pointer transition-all duration-300"
                      onClick={handleSend}
                    >
                      <span>
                        <GiShare className="fill-[#AF9918] text-2xl transition-transform transform group-hover:scale-110 group-hover:duration-300" />
                      </span>
                      <span className="text-[#AF9918] transition-all duration-300 group-hover:text-[#D5A100]">
                        Send
                      </span>
                    </div>
                  </>
                )}
              </div>
            </>
          }
          buttonContent={""}
        />

        <UploadModal
          fetchJobs={fetchJobs}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />

        <div className="flex-1 px-2 bg-white">
          {/* sticky top-0 z-10 */}
          <div
            className={`bg-gray-200 p-3 mb-0 transition-all duration-500 ease-in w-full sm:w-auto  ${
              isFilterDropDownOpen ? "rounded-t-lg" : "rounded-lg"
            }`}
          >
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setIsFilterDropDownOpen(!isFilterDropDownOpen)}
            >
              <span className="text-gray-800 text-sm sm:text-base md:text-lg">
                Filters
              </span>
              <span>
                <IoIosArrowForward
                  className={`text-xl p-0 text-[#005B97] transition-all duration-500 ease-in ${
                    isFilterDropDownOpen ? "rotate-90" : ""
                  }`}
                />
              </span>
            </div>
          </div>
          {/* sticky top-0 z-40 */}
          <div
            className={`overflow-hidden transition-all duration-500 ease-in w-auto  ${
              isFilterDropDownOpen ? "max-h-[1000px] p-3" : "max-h-0"
            } flex flex-wrap gap-4 mt-0 bg-gray-200 rounded-b-lg`}
          >
            <form
              onSubmit={handleFilterApply}
              className="w-full grid grid-cols-3 gap-4"
            >
              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  BL Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter Bl Number"
                    value={bolNumberFilter}
                    onChange={(e) => setBolNumberFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-default"
                  >
                    <FiSearch size={20} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="finalStatusFilter"
                  className="text-sm font-semibold text-gray-800"
                >
                  Recognition Status
                </label>
                <div className="relative">
                  <select
                    id="finalStatusFilter"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                    value={finalStatusFilter}
                    onChange={(e) => setFinalStatusFilter(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="new">new</option>
                    <option value="inProgress">inProgress</option>
                    <option value="valid">valid</option>
                    <option value="partiallyValid">partiallyValid</option>
                    <option value="failure">failure</option>
                    <option value="sent">sent</option>
                  </select>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-[25px] transform -translate-y-1/2 text-gray-500 cursor-default"
                  >
                    <FaChevronDown size={16} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="finalStatusFilter"
                  className="text-sm font-semibold text-gray-800"
                >
                  Review Status
                </label>
                <div className="relative">
                  <select
                    id="finalStatusFilter"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                    value={reviewStatusFilter}
                    onChange={(e) => setReviewStatusFilter(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="unConfirmed">unConfirmed</option>
                    <option value="confirmed">confirmed</option>
                    <option value="deleted">deleted</option>
                    <option value="denied">denied</option>
                  </select>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-[25px] transform -translate-y-1/2 text-gray-500 cursor-default"
                  >
                    <FaChevronDown size={16} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  POD Date
                </label>
                <div className="relative">
                  <input
                    id="dateInput"
                    type="date"
                    placeholder="YYYY-MM-DD"
                    value={podDateFilter}
                    onChange={(e) => setPodDateFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
                    max="9999-12-31"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    onClick={() => {
                      const dateInput = document.getElementById(
                        "dateInput"
                      ) as HTMLInputElement;
                      if (dateInput) {
                        dateInput.showPicker();
                      }
                    }}
                  >
                    <IoCalendar size={20} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  Signature Exists
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Signature"
                    value={podDateSignatureFilter}
                    onChange={(e) => setPodDateSignatureFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                  ></button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="finalStatusFilter"
                  className="text-sm font-semibold text-gray-800"
                >
                  Reviewed By
                </label>
                <div className="relative">
                  <select
                    id="finalStatusFilter"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                    value={reviewByStatusFilter}
                    onChange={(e) => setReviewByStatusFilter(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="Admin">Admin</option>
                    <option value="OCR Engine">OCR Engine</option>
                  </select>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-[25px] transform -translate-y-1/2 text-gray-500 cursor-default"
                  >
                    <FaChevronDown size={16} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="finalStatusFilter"
                  className="text-sm font-semibold text-gray-800"
                >
                  Breakdown Reason
                </label>
                <div className="relative">
                  <select
                    id="finalStatusFilter"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                    value={reasonStatusFilter}
                    onChange={(e) => setReasonStatusFilter(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="none">none</option>
                    <option value="damaged">damaged</option>
                    <option value="shortage">shortage</option>
                    <option value="overage">overage</option>
                    <option value="refused">refused</option>
                  </select>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-[25px] transform -translate-y-1/2 text-gray-500 cursor-default"
                  >
                    <FaChevronDown size={16} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  Job Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Job name"
                    value={jobNameFilter}
                    onChange={(e) => setJobNameFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  />
                </div>
              </div>
              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  Created Date
                </label>
                <div className="relative">
                  <input
                    id="createdDate"
                    type="date"
                    placeholder="YYYY-MM-DD"
                    value={createdDateFilter}
                    onChange={(e) => setCreatedDateFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
                    max="9999-12-31"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    onClick={() => {
                      const createdDate = document.getElementById(
                        "createdDate"
                      ) as HTMLInputElement;
                      if (createdDate) {
                        createdDate.showPicker();
                      }
                    }}
                  >
                    <IoCalendar size={20} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="finalStatusFilter"
                  className="text-sm font-semibold text-gray-800"
                >
                  Update User
                </label>
                <div className="relative">
                  <select
                    id="finalStatusFilter"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                    value={uptd_Usr_Cd}
                    onChange={(e) => setUptd_Usr_Cd(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="OCR">OCR</option>
                  </select>
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-[25px] transform -translate-y-1/2 text-gray-500 cursor-default"
                  >
                    <FaChevronDown size={16} className="text-[#005B97]" />
                  </button>
                </div>
              </div>
              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  Updated Date
                </label>
                <div className="relative">
                  <input
                    id="updatedDate"
                    type="date"
                    placeholder="YYYY-MM-DD"
                    value={updatedDateFilter}
                    onChange={(e) => setUpdatedDateFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] custom-date-input"
                    max="9999-12-31"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                    onClick={() => {
                      const updatedDate = document.getElementById(
                        "updatedDate"
                      ) as HTMLInputElement;
                      if (updatedDate) {
                        updatedDate.showPicker();
                      }
                    }}
                  >
                    <IoCalendar size={20} className="text-[#005B97]" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  File Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="File name"
                    value={fileNameFilter}
                    onChange={(e) => setFileNameFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  File ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="File ID"
                    value={fileIdFilter}
                    onChange={(e) => setFileIdFilter(e.target.value)}
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  />
                </div>
              </div>

              <div className="flex justify-end items-center gap-2 col-span-3">
                <button
                  className={`text-[#005B97] underline ${
                    !isAnyFilterApplied()
                      ? "text-gray-400 underline cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  onClick={resetFiltersAndFetch}
                  disabled={!isAnyFilterApplied()}
                >
                  Reset Filters
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-[#005B97] text-white hover:bg-[#2270a3]"
                >
                  Apply Filters
                </button>
              </div>
            </form>
          </div>

          <div className="my-5 flex flex-wrap md:flex-nowrap justify-between items-center gap-4">
            <div className="w-full md:w-auto">
              <form
                // onSubmit={handleFilterApply}
                className="w-full flex flex-wrap md:flex-nowrap gap-4 items-center"
              >
                <div
                  className="flex items-center gap-3 min-w-0 relative"
                  ref={dropdownRef}
                >
                  <label
                    htmlFor="sortColumn"
                    className="text-sm font-semibold text-gray-800 whitespace-nowrap"
                  >
                    Sort By:
                  </label>

                  <div className="relative w-full sm:w-44">
                    <button
                      type="button"
                      className="w-full px-4 py-2 border rounded-md text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#005B97] text-left flex justify-between items-center"
                      onClick={() => setIsOpen(!isOpen)}
                    >
                      {/* {sortColumn.length > 0 ? sortColumn.join(", ") : "Select columns"} */}
                      {"Select columns"}

                      <FaChevronDown size={16} className="text-[#005B97]" />
                    </button>

                    {isOpen && (
                      <div className="absolute z-30 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                        {options.map((option) => (
                          <label
                            key={option.value}
                            className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 text-[#005B97] cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              value={option.value}
                              checked={sortColumn.includes(option.value)}
                              onChange={handleSortColumnChange}
                              className="form-checkbox h-4 w-4 text-[#005B97] cursor-pointer"
                            />
                            <span className="flex-1 truncate">
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 min-w-0">
                  <label
                    htmlFor="sortOrder"
                    className="text-sm font-semibold text-gray-800 whitespace-nowrap"
                  >
                    Sorting Order:
                  </label>
                  <div className="relative w-full sm:w-40">
                    <select
                      id="sortOrder"
                      className="w-full px-4 py-2 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                      value={sortOrder}
                      onChange={handleSortOrderChange}
                    >
                      <option value="asc">Ascending</option>
                      <option value="desc">Descending</option>
                    </select>
                    <button
                      type="button"
                      className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500 cursor-default"
                    >
                      <FaChevronDown size={16} className="text-[#005B97]" />
                    </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto justify-center md:justify-start">
              <Link
                href={{
                  pathname: "/history",
                  query:
                    selectedRows.length > 0
                      ? { selectedRows: JSON.stringify(selectedRows) }
                      : undefined,
                }}
              >
                <button
                  className={`rounded-lg px-6 py-2 w-full md:w-auto ${
                    selectedRows.length === 0
                      ? "cursor-not-allowed bg-gray-400 border border-gray-400"
                      : "bg-[#005B971A] text-[#005B97] border border-[#005B971A]"
                  }`}
                >
                  History
                </button>
              </Link>

              <button
                className="hover:bg-[#005B97] hover:text-white border-[#005B97] border text-[#005B97] 
                rounded-lg px-6 py-2 w-full md:w-auto flex items-center justify-center gap-2 transition"
                onClick={() => setIsModalOpen(true)}
              >
                <FiUpload className="text-xl" />
                <span>Upload File</span>
              </button>

              <p
                onClick={
                  selectedRows.length > 0 || isOcrRunning
                    ? handleOcrToggle
                    : undefined
                }
                className={` ${buttonColor} flex justify-center items-center w-full md:w-auto px-4 py-2 rounded-lg text-white transition 
                ${
                  selectedRows.length === 0 && !isOcrRunning
                    ? "bg-gray-400 cursor-not-allowed border border-gray-400"
                    : "cursor-pointer border border-[#005B97]"
                }
              `}
              >
                {isOcrRunning ? "Stop" : "Process"}
              </p>
            </div>
          </div>

          {isProcessModalOpen && (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
              <div className="bg-white p-5 rounded-lg mt-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-black">
                      Processing<span className="dot-animation"></span>
                    </h2>
                    <p className="text-[#7B849A]">
                      Please wait we are Processing your files will take just
                      few moments
                    </p>
                  </div>
                  <div>
                    <p
                      onClick={
                        selectedRows.length > 0 || isOcrRunning
                          ? handleOcrToggle
                          : undefined
                      }
                      className={` ${buttonColor} flex justify-center items-center w-fit px-4 py-2 rounded-lg text-white transition 
                    ${
                      selectedRows.length === 0 && !isOcrRunning
                        ? "bg-gray-400 cursor-not-allowed border border-gray-400"
                        : "cursor-pointer border border-[#005B97]"
                    }
                  `}
                    >
                      {isOcrRunning ? "Stop Processing" : "Process"}
                    </p>
                  </div>
                </div>

                <div className="overflow-scroll min-h-auto max-h-96">
                  <table className="min-w-full border-separate border-spacing-y-3">
                    <thead>
                      <tr className="border-b border-gray-400">
                        <th className=" px-4 py-2 text-left text-black border-b border-gray-400">
                          File Name
                        </th>
                        <th className=" px-4 py-2 text-black min-w-72 text-center border-b border-gray-400">
                          Progress
                        </th>
                        <th className=" px-4 py-2 text-black text-center border-b border-gray-400">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="">
                      {/* {selectedRows.map((rowId) => {
                        const job = master.find((job) => job._id === rowId);
                        if (!job || !job.pdfUrl) return null; */}
                      {selectedRows
                        .filter((rowId) => {
                          const job = master.find((job) => job._id === rowId);
                          return (
                            job && (!job.blNumber || !job.podSignature?.trim())
                          );
                        })
                        .map((rowId) => {
                          const job = master.find((job) => job._id === rowId);
                          if (!job || !job.pdfUrl) return null;
                          // const pdfFilename = job.pdfUrl.split('/').pop();
                          const pdfFilename = job.pdfUrl
                            ? encodeURIComponent(
                                job.pdfUrl.split("/").pop()?.trim() ?? ""
                              )
                            : "";
                          const progressKey = `${baseUrl}/api/access-file?filename=${pdfFilename}`;
                          const jobProgress = progress[progressKey] ?? 0;
                          // style={{ width: `${jobProgress}%` }}
                          // {jobProgress}%
                          return (
                            <tr key={job._id} className="">
                              <td className=" px-4 py-2 text-black">
                                {/* {job.pdfUrl ? job.pdfUrl.split('/').pop()?.replace('.pdf', '') || "No PDF Available" : "No PDF Available"} */}
                                {job.pdfUrl
                                  ? (() => {
                                      const fileName =
                                        job.pdfUrl
                                          .split("/")
                                          .pop()
                                          ?.replace(".pdf", ".pdf") ||
                                        "No PDF Available";
                                      return fileName.length > 15
                                        ? fileName.substring(0, 19) + "..."
                                        : fileName;
                                    })()
                                  : "No PDF Available"}
                              </td>
                              {/* <td className=" px-4 py-2">

                              <div className="w-full bg-gray-200 rounded-full h-4 relative">
                                <div
                                  className="bg-[#005B97] h-4 rounded-full relative transition-all duration-500 ease-in-out"
                                  style={{ width: `${progress[job.pdfUrl] ?? 0}%` }}
                                >
                                  <span
                                    className="absolute top-1/2 right-[-1.01rem] transform -translate-y-1/2 translate-x-1/2 flex items-center px-2 h-6 text-[#005B97] font-medium bg-gray-300 font-semibold text-sm"
                                  >
                                    {progress[job.pdfUrl] ?? 0}%
                                  </span>
                                </div>
                              </div>

                            </td> */}

                              <td className="px-4 py-2">
                                <div
                                  className={`${
                                    jobProgress === 1
                                      ? "bg-[rgba(252,197,197,0.1)]"
                                      : "bg-gray-200"
                                  } w-full rounded-full h-4 relative`}
                                >
                                  <div
                                    className={`bg-[#005B97] h-4 rounded-full relative transition-all duration-500 ease-in-out`}
                                    style={{ width: `${jobProgress}%` }}
                                  >
                                    <span
                                      className={`absolute top-1/2 right-[-1.01rem] transform -translate-y-1/2 translate-x-1/2 flex items-center px-2 h-6 text-[#005B97] ${
                                        jobProgress === 1
                                          ? "bg-gray-300"
                                          : "bg-gray-300"
                                      }  font-semibold text-sm`}
                                    >
                                      {jobProgress === 1 ? 0 : jobProgress}%
                                    </span>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-2 text-center">
                                <span
                                  className={`px-3 py-2 rounded-full text-base font-medium ${
                                    jobProgress === 100
                                      ? "bg-[#28A4AD1A] text-[#28A4AD]"
                                      : jobProgress > 1
                                      ? "bg-[#FCB0401A] text-[#FCB040]"
                                      : jobProgress === 0
                                      ? "bg-[#005B971A] text-[#005B97]"
                                      : jobProgress === 1
                                      ? "bg-[rgba(252,197,197,0.1)] text-[#FF4D4D]"
                                      : ""
                                  }`}
                                >
                                  {jobProgress === 100
                                    ? "Valid"
                                    : jobProgress > 1
                                    ? "In Progress"
                                    : jobProgress === 0
                                    ? "New"
                                    : jobProgress === 1
                                    ? "Failed"
                                    : ""}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                {/* <span className="absolute top-0 left-1/2 transform -translate-x-1/2 text-xs text-white">
                  {progress[job.pdfUrl] ?? 0}%
                  </span> */}
              </div>
            </div>
          )}

          {/* {isOcrRunning && (
            <div className="flex items-center justify-between gap-5">
              <div className="w-full">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div className="bg-[#005B97] h-4 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
              <div>
                <p className="text-2xl text-[#005B97] font-semibold">
                  {progress}/<span className="text-black">100(%)</span>
                </p>
              </div>
            </div>
          )} */}

          <div className="py-3 mx-auto z-10">
            {master.length === 0 && !loadingTable ? (
              <div className="flex flex-col items-center mt-20">
                <span className="text-gray-800 text-xl shadow-xl p-4 rounded-lg">
                  No data found
                </span>
              </div>
            ) : (
              <div
                className={`overflow-x-auto w-full relative ${
                  isFilterDropDownOpen
                    ? "2xl:h-[700px] md:h-[170px] sm:h-[150px]"
                    : "2xl:h-[900px] md:h-[460px] sm:h-[450px]"
                }`}
              >
                {/* <div className={`overflow-x-auto w-full relative`}> */}
                <table className="table-auto min-w-full w-full border-collapse">
                  <thead className="sticky top-0 bg-white z-20 shadow-md">
                    <tr className="text-gray-800">
                      <th className="py-2 px-4 border-b text-start min-w-44 max-w-44 sticky left-0 bg-white z-20">
                        <span className="mr-3">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={handleSelectAll}
                          />
                        </span>
                        BL Number
                      </th>

                      <th className="py-2 px-4 border-b text-center min-w-44 max-w-44 sticky left-44 bg-white z-10">
                        File Name
                      </th>

                      <th className="py-2 px-4 border-b text-center min-w-44 max-w-44 sticky left-[22rem] bg-white z-10">
                        Job Name
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-44 max-w-44 left-44 bg-white z-10">
                        File ID
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-32">
                        POD Date
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-36">
                        Stamp Exists
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-40">
                        Signature Exists
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-36">
                        Seal Intact
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-32">
                        Issued Qty
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-36">
                        Received Qty
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-36">
                        Damaged Qty
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-28">
                        Short Qty
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-28">
                        Over Qty
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-32">
                        Refused Qty
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-52">
                        Customer Order Num
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-32">
                        Final Status
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-36">
                        Review Status
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-48">
                        Recognition Status
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-48">
                        Breakdown Reason
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-36">
                        Reviewed By
                      </th>
                      <th className="py-2 px-4 border-b text-center min-w-28">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="relative">
                    {loadingTable ? (
                      <tr>
                        <td
                          colSpan={Object.keys(master[0] || {}).length}
                          className="text-center"
                        >
                          <div className="flex justify-center">
                            <TableSpinner />
                          </div>
                        </td>
                      </tr>
                    ) : master.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9999}
                          className="py-10 text-center text-gray-800 text-xl shadow-xl p-4 rounded-lg"
                        >
                          No data found
                        </td>
                      </tr>
                    ) : (
                      master.map((job) => {
                        return (
                          <tr key={job._id} className="text-gray-500">
                            <td className="py-2 px-4 border-b text-start m-0 sticky left-0 bg-white z-10">
                              <span className="mr-3">
                                <input
                                  type="checkbox"
                                  checked={selectedRows.includes(job._id)}
                                  onChange={() => handleRowSelection(job._id)}
                                />
                              </span>
                              <Link
                                href={`/extracted-data-monitoring/${job._id}`}
                                onClick={() => {
                                  handleRouteChange();
                                  localStorage.setItem("prev", "");
                                }}
                                className="group"
                              >
                                <span className="text-[#005B97] underline group-hover:text-blue-500 transition-all duration-500 transform group-hover:scale-110">
                                  {job.blNumber}
                                </span>
                              </Link>
                            </td>

                            <FileNameCell
                              pdfUrl={job.pdfUrl}
                              fileId={job.fileName}
                            />

                            <td className="py-2 px-4 border-b text-center min-w-44 max-w-44 sticky left-[22rem] bg-white z-10">
                              {job.jobName}
                            </td>
                            <TruncatedCell
                              value={job.fileId || job._id || "N/A"}
                            />

                            <td className="py-2 px-4 border-b text-center">
                              {job.podDate}
                            </td>

                            <td className="py-2 px-4 border-b text-center">
                              {job.stampExists === null ||
                              job.stampExists === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.stampExists
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.podSignature === null ||
                              job.podSignature === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.podSignature
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.sealIntact === null ||
                              job.sealIntact === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.sealIntact
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.totalQty === null ||
                              job.totalQty === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.totalQty
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.received === null ||
                              job.received === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.received
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.damaged === null ||
                              job.damaged === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.damaged
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.short === null || job.short === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.short
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.over === null || job.over === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.over
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.refused === null ||
                              job.refused === undefined ? (
                                <span className="flex justify-center items-center">
                                  {/* <IoIosInformationCircle className="text-2xl text-red-500" /> */}
                                </span>
                              ) : (
                                job.refused
                              )}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {Array.isArray(job.customerOrderNum)
                                ? job.customerOrderNum.join(", ")
                                : job.customerOrderNum || ""}
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              <Tippy
                                onMount={(instance) => {
                                  parentRefFinal.current = instance;
                                }}
                                onHide={() => {
                                  parentRefFinal.current = null;
                                  setDropdownStates(null);
                                }}
                                content={
                                  <ul className="bg-white border text-center rounded-md shadow-lg w-32">
                                    {finalOptions.map(
                                      ({ status, color, bgColor }) => (
                                        <li
                                          key={status}
                                          className={`cursor-pointer px-3 py-1 hover:bg-blue-100 hover:text-black ${
                                            job.finalStatus === status
                                              ? `${color} ${bgColor}`
                                              : color
                                          }`}
                                          onClick={() => {
                                            updateStatus(
                                              job._id,
                                              "finalStatus",
                                              status,
                                              name
                                            );
                                            parentRefFinal.current?.hide();
                                          }}
                                        >
                                          {status}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                }
                                interactive={true}
                                trigger="click"
                                placement="bottom"
                                arrow={false}
                                zIndex={50}
                                onShow={() => {
                                  if (userRole !== "standarduser") {
                                    setDropdownStates(job._id);
                                  } else {
                                    return false;
                                  }
                                }}
                                appendTo={() => document.body}
                              >
                                <div
                                  className={`inline-flex items-center transition-all duration-500 ease-in-out justify-center gap-0 px-2 py-1 rounded-full text-sm font-medium ${
                                    userRole !== "standarduser"
                                      ? "cursor-pointer"
                                      : ""
                                  } ${
                                    job.finalStatus === "new"
                                      ? "bg-blue-100 text-blue-600"
                                      : job.finalStatus === "inProgress"
                                      ? "bg-yellow-100 text-yellow-600"
                                      : job.finalStatus === "valid"
                                      ? "bg-green-100 text-green-600"
                                      : job.finalStatus === "partiallyValid"
                                      ? "bg-[#faf1be] text-[#AF9918]"
                                      : job.finalStatus === "failure"
                                      ? "bg-red-100 text-red-600"
                                      : job.finalStatus === "sent"
                                      ? "bg-green-100 text-green-600"
                                      : "bg-gray-100 text-gray-600"
                                  }`}
                                >
                                  <div>{job.finalStatus}</div>
                                  <RiArrowDropDownLine
                                    className={`text-2xl p-0 transform transition-transform duration-300 ease-in-out ${
                                      dropdownStates === job._id
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                  />
                                </div>
                              </Tippy>
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              <Tippy
                                onMount={(instance) => {
                                  parentRefReview.current = instance;
                                }}
                                onHide={() => {
                                  parentRefReview.current = null;
                                  setDropdownStatesFirst(null);
                                }}
                                content={
                                  <ul className="bg-white border text-center rounded-md shadow-lg w-32">
                                    {reviewOptions.map(
                                      ({ status, color, bgColor }) => (
                                        <li
                                          key={status}
                                          className={`cursor-pointer px-3 py-1 hover:bg-blue-100 hover:text-black ${
                                            job.reviewStatus === status
                                              ? `${color} ${bgColor}`
                                              : color
                                          }`}
                                          onClick={() => {
                                            updateStatus(
                                              job._id,
                                              "reviewStatus",
                                              status,
                                              name
                                            );
                                            parentRefReview.current?.hide();
                                          }}
                                        >
                                          {status}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                }
                                interactive={true}
                                trigger="click"
                                placement="bottom"
                                arrow={false}
                                zIndex={50}
                                onShow={() => {
                                  if (userRole !== "standarduser") {
                                    setDropdownStatesFirst(job._id);
                                  } else {
                                    return false;
                                  }
                                }}
                                appendTo={() => document.body}
                              >
                                <div
                                  className={`inline-flex items-center transition-all duration-500 ease-in-out justify-center gap-0 px-2 py-1 rounded-full text-sm font-medium ${
                                    userRole !== "standarduser"
                                      ? "cursor-pointer"
                                      : ""
                                  } ${
                                    job.reviewStatus === "unConfirmed"
                                      ? "bg-yellow-100 text-yellow-600"
                                      : job.reviewStatus === "confirmed"
                                      ? "bg-green-100 text-green-600"
                                      : job.reviewStatus === "denied"
                                      ? "bg-[#faf1be] text-[#AF9918]"
                                      : job.reviewStatus === "deleted"
                                      ? "bg-red-100 text-red-600"
                                      : ""
                                  }`}
                                >
                                  <div>{job.reviewStatus}</div>
                                  <RiArrowDropDownLine
                                    className={`text-2xl p-0 transform transition-transform duration-300 ease-in-out ${
                                      dropdownStatesFirst === job._id
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                  />
                                </div>
                              </Tippy>
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              <Tippy
                                onMount={(instance) => {
                                  parentRefRecognition.current = instance;
                                }}
                                onHide={() => {
                                  parentRefRecognition.current = null;
                                  setDropdownStatesSecond(null);
                                }}
                                content={
                                  <ul className="bg-white border text-center rounded-md shadow-lg w-32">
                                    {recognitionOptions.map(
                                      ({ status, color, bgColor }) => (
                                        <li
                                          key={status}
                                          className={`cursor-pointer px-3 py-1 hover:bg-blue-100 hover:text-black ${
                                            job.recognitionStatus === status
                                              ? `${color} ${bgColor}`
                                              : color
                                          }`}
                                          onClick={() => {
                                            updateStatus(
                                              job._id,
                                              "recognitionStatus",
                                              status,
                                              name
                                            );
                                            parentRefRecognition.current?.hide();
                                          }}
                                        >
                                          {status}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                }
                                interactive={true}
                                trigger="click"
                                placement="bottom"
                                arrow={false}
                                zIndex={50}
                                onShow={() => {
                                  if (userRole !== "standarduser") {
                                    setDropdownStatesSecond(job._id);
                                  } else {
                                    return false;
                                  }
                                }}
                                appendTo={() => document.body}
                              >
                                <div
                                  className={`inline-flex items-center transition-all duration-500 ease-in-out justify-center gap-0 px-2 py-1 rounded-full text-sm font-medium ${
                                    userRole !== "standarduser"
                                      ? "cursor-pointer"
                                      : ""
                                  } ${
                                    job.recognitionStatus === "new"
                                      ? "bg-blue-100 text-blue-600"
                                      : job.recognitionStatus === "inProgress"
                                      ? "bg-yellow-100 text-yellow-600"
                                      : job.recognitionStatus === "valid"
                                      ? "bg-green-100 text-green-600"
                                      : job.recognitionStatus ===
                                        "partiallyValid"
                                      ? "bg-[#faf1be] text-[#AF9918]"
                                      : job.recognitionStatus === "failure"
                                      ? "bg-red-100 text-red-600"
                                      : job.recognitionStatus === "sent"
                                      ? "bg-green-100 text-green-600"
                                      : ""
                                  }`}
                                >
                                  <div>{job.recognitionStatus}</div>
                                  <RiArrowDropDownLine
                                    className={`text-2xl p-0 transform transition-transform duration-300 ease-in-out ${
                                      dropdownStatesSecond === job._id
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                  />
                                </div>
                              </Tippy>
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              <Tippy
                                onMount={(instance) => {
                                  parentRefBreakdown.current = instance;
                                }}
                                onHide={() => {
                                  parentRefBreakdown.current = null;
                                  setDropdownStatesThird(null);
                                }}
                                content={
                                  <ul className="bg-white border text-center rounded-md shadow-lg w-32">
                                    {breakdownOptions.map(
                                      ({ status, color, bgColor }) => (
                                        <li
                                          key={status}
                                          className={`cursor-pointer px-3 py-1 hover:bg-blue-100 hover:text-black ${
                                            job.breakdownReason === status
                                              ? `${color} ${bgColor}`
                                              : color
                                          }`}
                                          onClick={() => {
                                            updateStatus(
                                              job._id,
                                              "breakdownReason",
                                              status,
                                              name
                                            );
                                            parentRefBreakdown.current?.hide();
                                          }}
                                        >
                                          {status}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                }
                                interactive={true}
                                trigger="click"
                                placement="bottom"
                                arrow={false}
                                zIndex={50}
                                onShow={() => {
                                  if (userRole !== "standarduser") {
                                    setDropdownStatesThird(job._id);
                                  } else {
                                    return false;
                                  }
                                }}
                                appendTo={() => document.body}
                              >
                                <div
                                  className={`inline-flex items-center transition-all duration-500 ease-in-out justify-center gap-0 px-2 py-1 rounded-full text-sm font-medium ${
                                    userRole !== "standarduser"
                                      ? "cursor-pointer"
                                      : ""
                                  } ${
                                    job.breakdownReason === "none"
                                      ? "bg-blue-100 text-blue-600"
                                      : job.breakdownReason === "damaged"
                                      ? "bg-yellow-100 text-yellow-600"
                                      : job.breakdownReason === "shortage"
                                      ? "bg-green-100 text-green-600"
                                      : job.breakdownReason === "overage"
                                      ? "bg-[#faf1be] text-[#AF9918]"
                                      : job.breakdownReason === "refused"
                                      ? "bg-red-100 text-red-600"
                                      : ""
                                  }`}
                                >
                                  <div>{job.breakdownReason}</div>
                                  <RiArrowDropDownLine
                                    className={`text-2xl p-0 transform transition-transform duration-300 ease-in-out ${
                                      dropdownStatesThird === job._id
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                  />
                                </div>
                              </Tippy>
                            </td>
                            <td className="py-2 px-4 border-b text-center">
                              {job.reviewedBy}
                            </td>
                            <td className="py-2 px-6 border-b text-center">
                              <Link
                                href={`/extracted-data-monitoring/edit-pdf/${job._id}`}
                                onClick={() => {
                                  handleRouteChange();
                                  localStorage.setItem("prev", "");
                                }}
                                className="underline text-[#005B97] flex items-center gap-1 transition-all duration-300 hover:text-blue-500 group"
                              >
                                Detail
                                <span className="transform transition-transform duration-300 ease-in-out group-hover:translate-x-1">
                                  <IoIosArrowForward className="text-xl p-0" />
                                </span>
                              </Link>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {master.length !== 0 && (
              <div className="mt-5 flex justify-end gap-5 items-center text-gray-800">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-md ${
                    currentPage === 1
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  Previous
                </button>
                <span>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-md ${
                    currentPage === totalPages
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default MasterPage;
