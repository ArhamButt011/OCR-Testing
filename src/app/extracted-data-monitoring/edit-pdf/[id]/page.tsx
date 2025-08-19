"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useParams, useRouter } from "next/navigation";
import { FaArrowLeftLong } from "react-icons/fa6";
import Spinner from "@/app/components/Spinner";
import { useSidebar } from "../../../context/SidebarContext";
import Link from "next/link";
import { ObjectId } from "mongodb";
import { useDBConnection } from "@/app/context/DBConnectionContext";

interface Job {
  _id: ObjectId;
  pdfUrl: string;
  blNumber: string;
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
  sealIntact: string;
  finalStatus: string;
  reviewStatus: string;
  recognitionStatus: string;
  breakdownReason: string;
  reviewedBy: string;
  cargoDescription: string;
  createdAt: string;
  updatedAt?: string;
}

const JobDetail = () => {
  const { id } = useParams();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    blNumber: "",
    podDate: "",
    totalQty: "",
    received: "",
    damaged: "",
    short: "",
    over: "",
    refused: "",
    stampExists: "",
    sealIntact: "",
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [name, setName] = useState("");
  const { db } = useDBConnection();
  const { isExpanded } = useSidebar();
  const [base64Data, setBase64Data] = useState("");
  const [mimeType, setMimeType] = useState();
  const handleSidebarStateChange = (newState: boolean) => {
    // setIsSidebarExpanded(newState);
    return newState;
  };

  console.log(isLoading)
  

  const isSupportedFormat = (fileName: string) => {
    const ext = fileName.toLowerCase().split(".").pop();
    return ["pdf", "jpg", "jpeg", "png", "bmp"].includes(ext || "");
  };

  // const formatDateForInput = (dateStr: string | null) => {
  //     if (!dateStr) return "";
  //     const [month, day, year] = dateStr.split("/");
  //     return `20${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  // };

  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return "";

    const parts = dateStr.split("/");
    if (parts.length < 2) return "";

    const [month, day, rawYear] = [...parts, "2024"].slice(0, 3);

    let year = rawYear;
    if (year.length === 2) {
      const currentYear = new Date().getFullYear();
      const century = Math.floor(currentYear / 100) * 100;
      year = (parseInt(year, 10) + century).toString();
    }

    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  };

  const formatDateForDB = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${month}/${day}/${year.slice(-2)}`;
  };

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
    setUserRole(decodedToken.role);

    setName(decodedToken.username);
  }, [router]);

  useEffect(() => {
    if (id && db) {
      setLoading(true);
      fetch(`/api/process-data/detail-data/${id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            console.log("data.job-> ", data.job);
            setJob(data.job);
            setBase64Data(data.base64Data);

            setMimeType(data.mimeType);
            setFormData({
              blNumber: data.job.blNumber || "",
              podDate: formatDateForInput(data.job.podDate || ""),
              totalQty: data.job.totalQty?.toString() ?? "",
              received: data.job.received ?? "",
              damaged: data.job.damaged ?? "",
              short: data.job.short ?? "",
              over: data.job.over ?? "",
              refused: data.job.refused ?? "",
              stampExists: data.job.stampExists ?? "",
              sealIntact: data.job.sealIntact ?? "",
            });
            setLoading(false);
          }
          setLoading(false);
        })
        .catch((err) => {
          console.log("Error fetching job details:", err);
          setError("Failed to fetch job details");
          setLoading(false);
        });
    }
  }, [id, db]);

  // const mimeTypeSafe = mimeType ?? "application/pdf";
  // const fileExtension = getFileExtension(mimeTypeSafe);
  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // const numericFields = [
    //     "totalQty",
    //     "received",
    //     "damaged",
    //     "short",
    //     "over",
    //     "refused",
    // ];

    const nonNumericFields = [
      "blNumber",
      "totalQty",
      "received",
      "damaged",
      "short",
      "over",
      "refused",
      "stampExists",
      "sealIntact",
    ];

    if (name === "podDate") {
      setFormData((prev) => ({
        ...prev,
        podDate: value,
      }));
      return;
    }
    if (nonNumericFields.includes(name)) {
      const isValidNonNumeric =
        value === "" ||
        (/^[a-zA-Z0-9_]+(\s[a-zA-Z0-9_]+)*$/.test(value) &&
          !/^\s/.test(value) &&
          !/^0+$/.test(value));
      if (isValidNonNumeric) {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const capitalizeFirstLetter = (str: string): string => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formattedReviewedBy = capitalizeFirstLetter(name);

      const formattedData = {
        ...formData,
        podDate: formatDateForDB(formData.podDate),
      };

      const response = await fetch(`/api/process-data/detail-data/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-name": formattedReviewedBy,
        },
        body: JSON.stringify(formattedData),
      });

      if (response.ok) {
        setIsEditMode(false);
      } else {
        setIsEditMode(false);
        setSaving(false);
      }
    } catch (error) {
      console.log("Error saving data:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = () => {
    setIsEditMode(true);
  };

  const keyMappings: Record<string, string> = {
    totalQty: "Issued Qty",
    received: "Received Qty",
    damaged: "Damaged Qty",
    short: "Short Qty",
    over: "Over Qty",
    refused: "Refused Qty",
  };

  if (!job) return <>{error}</>;


  const fileName = job.pdfUrl.split("/").pop();

  return (
    <div className="flex flex-row h-screen bg-white">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          isExpanded ? "ml-64" : "ml-24"
        }`}
      >
        <div className="bg-gray-100 py-4 flex justify-between items-center my-10 mx-5 rounded-lg px-8">
          <div className="flex items-center gap-5">
            <span
              className="text-[#005B97] cursor-pointer"
              onClick={handleGoBack}
            >
              <FaArrowLeftLong size={30} />
            </span>
            <span className="text-gray-800 text-xl font-[550]">
              {job.blNumber}
            </span>
          </div>
          <div>
            <Link
              href={`/api/access-file?filename=${fileName}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <button className="bg-[#005B97] rounded-lg py-2 px-10 text-white md:mt-0 w-60 md:w-auto">
                View Pdf
              </button>
            </Link>
          </div>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <>
            <div className="mx-5 flex bg-white pt-3 h-5/6">
              <div className="flex-auto xl:h-[calc(143vh-6rem)] 2xl:h-screen bg-white relative">
              
                {db === "local" ? (
                  <>
                 
                    {fileName && isSupportedFormat(fileName) ? (
                      <iframe
                        src={`${job.pdfUrl}#toolbar=0`}
                        // src={`/api/access-file?filename=${fileName}#toolbar=0`}
                        className="w-11/12 h-full bg-white"
                        loading="lazy"
                        onLoad={handleIframeLoad}
                      />
                    ) : (
                      <div className="text-center text-red-500">
                        Preview not available or unsupported file format.
                      </div>
                    )}
                  </>
                ) : db === "remote" ? (
                  <>
                    <iframe
                      src={`data:${mimeType};base64,${base64Data}`}
                      className="w-full h-screen"
                      title="PDF Preview"
                    />
                  </>
                ) : (
                  <div className="text-center text-red-500">
                    Preview not available or filename is missing.
                  </div>
                )}
              </div>
              <div className="flex-1 bg-gray-100 rounded-xl p-6 flex flex-col  xl:h-[calc(170vh-6rem)] 2xl:h-[calc(130vh-6rem)]">
                <div className="flex justify-between items-center mb-4">
                  <span>
                    <h3 className="text-xl font-medium text-gray-800">
                      Extracted Data
                    </h3>
                  </span>
                  <span>
                    {(userRole === "admin" || userRole === "standarduser") && (
                      <button
                        className={`text-[#005B97] underline ${
                          isEditMode ? "text-blue-300" : ""
                        }`}
                        onClick={handleEditClick}
                        disabled={isEditMode}
                      >
                        Edit Data
                      </button>
                    )}
                  </span>
                </div>
                <form className="space-y-10 flex-1 overflow-y-auto">
                  {Object.keys(formData).map((key) => (
                    <div
                      key={key}
                      className="flex items-center gap-3 bg-white px-2 border-l-8 border-[#005B97] rounded-lg py-[7px]"
                    >
                      {/* <label className="font-medium text-gray-500 capitalize min-w-28">
                                                {key.replace(/([A-Z])/g, " $1")} :
                                            </label> */}
                      <label className="font-medium text-gray-500 capitalize min-w-28">
                        {keyMappings[key] || key.replace(/([A-Z])/g, " $1")} :
                      </label>
                      <input
                        // type={key === "podDate" ? "date" : "text"}
                        type={"text"}
                        name={key}
                        value={formData[key as keyof typeof formData]}
                        onChange={handleChange}
                        disabled={!isEditMode}
                        className="p-2 text-gray-800 border-none focus:outline-none w-full"
                      />
                    </div>
                  ))}
                </form>

                {isEditMode && (
                  <>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="w-full bg-[#005B97] text-white font-medium py-3 rounded-lg hover:bg-[#2772a3] mt-auto"
                      disabled={saving}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JobDetail;
