"use client";

import Sidebar from '@/app/components/Sidebar';
import Spinner from '@/app/components/Spinner';
import { useEffect, useState } from 'react';
import { FaArrowLeftLong } from "react-icons/fa6";
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { FaCircleDot } from "react-icons/fa6";
import { useSidebar } from "../../context/SidebarContext";


const colors = [
    "#F59E0B",
    "#3B82F6",
    "#EF4444",
    "#A855F7",
    "#22C55E",
    "#E11D48",
    "#F97316",
    "#9333EA",
    "#D97706",
    "#6B21A8",
    "#DC2626",
    "#10B981",
    "#8B5CF6",
    "#F43F5E",
    "#3B82F6",
];

interface JobHistory {
    _id: string;
    jobId: string;
    field: string;
    oldValue: string;
    newValue: string;
    changedBy: string;
    changedOn: string;
}

const JobDetail = () => {
    const [jobHistory, setJobHistory] = useState<JobHistory[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { id } = useParams();
    const searchParams = useSearchParams();
    const blNumber = searchParams.get("blNumber");

    const { isExpanded } = useSidebar();

    const handleSidebarStateChange = (newState: boolean) => {
        // setIsSidebarExpanded(newState);
        return newState;
    };

    useEffect(() => {

        setLoading(true);
        const token = localStorage.getItem("token");

        if (!token) {
            router.push("/login");
            return;
        }

        const fetchJobHistory = async () => {
            try {
                const response = await fetch(`/api/history/get-history-data/${id}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch job history");
                }
                const data = await response.json();
                setJobHistory(data);
            } catch (err) {
                console.log("Error fetching job history:", err);
                setError("Failed to fetch job history");
            } finally {
                setLoading(false);
            }
        };

        fetchJobHistory();
    }, [id, router]);

    const handleGoBack = () => {
        router.back();
    };

    if (error) return <div className="text-red-500">{error}</div>;
    return (
        <div className="flex flex-row h-screen bg-white">
            <Sidebar onStateChange={handleSidebarStateChange} />
            <div
                className={`flex-1 flex flex-col transition-all bg-white duration-300 ${isExpanded ? "ml-64" : "ml-24"
                    }`}
            >
                <div className="bg-gray-100 py-3 flex justify-between items-center my-10 mx-5 rounded-lg px-8">
                    <div className="flex items-center gap-5">
                        <span className="text-[#005B97] cursor-pointer" onClick={handleGoBack}>
                            <FaArrowLeftLong size={30} />
                        </span>
                        <span className="text-gray-800 text-xl font-[550]">
                            {blNumber}
                        </span>
                    </div>
                </div>
                <div className='mx-5'>
                    {loading ? (
                        <div className="flex justify-center items-center">
                            <Spinner />
                        </div>
                    ) : (
                        <div className="flex gap-3">
                            <div className="relative flex flex-col items-center justify-between mt-20 mb-5">
                                <div className="absolute top-0 bottom-0 w-[4px] bg-gray-200 left-1/2 transform -translate-x-1/2"></div>
                                {jobHistory.map((history: JobHistory, index: number) => (
                                    <div
                                        key={index}
                                        className="w-6 h-5 flex items-center justify-center bg-white z-10"
                                    >
                                        <FaCircleDot fill={colors[index % colors.length]} size={25} />
                                    </div>
                                ))}
                            </div>
                            <table className="table-auto border-separate border-spacing-y-4 pb-0 w-full">
                                <thead className='mb-5'>
                                    <tr className="text-lg text-gray-800">
                                        <th className="py-2 px-4  text-start font-medium">Field</th>
                                        <th className="py-2 px-4  text-center font-medium">Old Value</th>
                                        <th className="py-2 px-4  text-center font-medium">New Value</th>
                                        <th className="py-2 px-4  text-center font-medium">Changed On</th>
                                        <th className="py-2 px-4  text-center font-medium">Changed By</th>
                                    </tr>
                                </thead>
                                <tbody className='space-y-4'>
                                    {jobHistory.map((history: JobHistory) => (
                                        <tr key={history._id} className="mb-4">
                                            <td className="py-4 px-4 text-start mt-10 bg-[#F3F4F6] rounded-l-lg text-gray-800 font-semibold">
                                                {history.field.charAt(0).toUpperCase() + history.field.slice(1)}
                                            </td>
                                            <td className="py-4 px-4 text-center bg-[#F3F4F6] text-gray-400">
                                                {history.oldValue}
                                            </td>
                                            <td className="py-4 px-4 text-center bg-[#F3F4F6] text-gray-400">
                                                {history.newValue}
                                            </td>
                                            <td className="py-4 px-4 text-center bg-[#F3F4F6] text-gray-400">
                                                {history.changedOn ? (() => {
                                                    const date = new Date(history.changedOn);
                                                    const month = String(date.getMonth() + 1).padStart(2, '0');
                                                    const day = String(date.getDate()).padStart(2, '0');
                                                    const year = date.getFullYear();
                                                    const hours = String(date.getHours()).padStart(2, '0');
                                                    const minutes = String(date.getMinutes()).padStart(2, '0');
                                                    const seconds = String(date.getSeconds()).padStart(2, '0');

                                                    return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
                                                })() : 'N/A'}
                                            </td>
                                            <td className="py-4 px-4 text-center bg-[#F3F4F6] text-gray-400 rounded-r-lg">
                                                {history.changedBy}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default JobDetail;
