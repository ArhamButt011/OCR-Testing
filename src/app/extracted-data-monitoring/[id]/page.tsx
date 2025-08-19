"use client";

import Sidebar from "@/app/components/Sidebar";
import EditModal from "@/app/components/EditModal";
import { format } from "date-fns";
import Spinner from "@/app/components/Spinner";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FaArrowLeftLong } from "react-icons/fa6";
import { useRouter } from "next/navigation";
import { BiSolidEditAlt } from "react-icons/bi";
import { useSidebar } from "../../context/SidebarContext";
import { ObjectId } from "mongodb";
import { useDBConnection } from "@/app/context/DBConnectionContext";

interface Job {
  _id: ObjectId;
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState("");
  const router = useRouter();
  const { id } = useParams();
  const { db } = useDBConnection();

  const { isExpanded } = useSidebar();

  const handleSidebarStateChange = (newState: boolean) => {
    // setIsSidebarExpanded(newState);
    return newState;
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
  }, [router]);

  useEffect(() => {
    if (id && db) {
      setLoading(true);
      fetch(`/api/process-data/detail-data/${id}?dbType=${db}`)
        .then((res) => res.json())
        .then((data) => {
          console.log('formdata-> ', data)
          if (data.error) {
            setError(data.error);
          } else {
            setJob(data.job);
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
  }, [id]);

  const handleGoBack = () => {
    router.back();
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleUpdateJob = (updatedJob: Job) => {
    setJob(updatedJob);
    setIsModalOpen(false);
  };
  if (!job) return <>{error}</>;
  return (
    <div className="flex flex-row h-screen bg-white">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          isExpanded ? "ml-64" : "ml-24"
        }`}
      >
        <div className="bg-gray-100 py-3 flex justify-between items-center my-10 mx-5 rounded-lg px-8">
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
            {(userRole === "admin" || userRole === "standarduser") && (
              <button
                className="text-[#005B97] rounded-lg py-2 px-10 md:mt-0 w-60 md:w-auto flex items-center gap-3 cursor-pointer"
                onClick={handleOpenModal}
              >
                <span>
                  <BiSolidEditAlt className="fill-[#005B97] text-2xl" />
                </span>
                <span>Edit Data</span>
              </button>
            )}
          </div>
        </div>
        <div className="mx-5">
          <h1 className="text-3xl text-gray-800 font-semibold mb-5">
            Shipment Information
          </h1>

          {loading ? (
            <Spinner />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 my-5">
                <div className="flex items-center gap-5">
                  <span className="text-xl text-gray-800 font-semibold">
                    Created On
                  </span>
                  <span className="text-xl text-gray-400 font-medium">
                    {job.createdAt
                      ? format(new Date(job.createdAt), "dd/MM/yyyy")
                      : "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-xl text-gray-800 font-semibold">
                    Delivery Date
                  </span>
                  <span className="text-xl text-gray-400 font-medium">
                    {job.deliveryDate
                      ? format(new Date(job.deliveryDate), "dd/MM/yyyy")
                      : "N/A"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 my-5">
                <div className="flex items-center gap-5">
                  <span className="text-xl text-gray-800 font-semibold">
                    Final Status
                  </span>
                  <span className="text-xl text-[#005B97] font-medium bg-blue-100 py-1 px-4 rounded-3xl">
                    {job.finalStatus}
                  </span>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-xl text-gray-800 font-semibold">
                    Review Status
                  </span>
                  <span className="text-xl text-green-600 font-medium bg-green-100 py-1 px-4 rounded-3xl">
                    {job.reviewStatus}
                  </span>
                </div>
                <div className="flex items-center gap-5">
                  <span className="text-xl text-gray-800 font-semibold">
                    Recognition Status
                  </span>
                  <span className="text-xl text-yellow-600 font-medium bg-yellow-100 py-1 px-4 rounded-3xl">
                    {job.recognitionStatus}
                  </span>
                </div>
              </div>
              <div className="flex flex-col my-5">
                <h1 className="text-xl text-gray-800 font-semibold mb-3">
                  Description
                </h1>
                <div className="text-gray-400 text-lg text-justify">
                  {job.cargoDescription}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {isModalOpen && (
        <EditModal
          job={job}
          onClose={handleCloseModal}
          onUpdate={handleUpdateJob}
        />
      )}
    </div>
  );
};

export default JobDetail;
