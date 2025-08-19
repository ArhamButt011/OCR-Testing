"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Spinner from "../components/Spinner";
import Image from "next/image";
import Link from "next/link";
import { useSidebar } from "../context/SidebarContext";
import { FaArrowLeftLong } from "react-icons/fa6";


export const dynamic = 'force-dynamic';

interface History {
    _id: string;
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

export default function Page() {
    return (
        <Suspense fallback={<Spinner />}>
            <PageContent />
        </Suspense>
    );
}

function PageContent() {
    const searchParams = useSearchParams();
    const [totalUsers, setTotalUsers] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [loadingTable, setLoadingTable] = useState(false);
    const [users, setUsers] = useState<History[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const router = useRouter();


    const selectedRows = useMemo(() => {
        const selectedRowsParam = searchParams.get("selectedRows");
        return selectedRowsParam ? JSON.parse(selectedRowsParam) : [];
    }, [searchParams]);

    const { isExpanded } = useSidebar();

    const handleSidebarStateChange = (newState: boolean) => {
        // setIsSidebarExpanded(newState);
        return newState;
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
    };

    const fetchUsers = useCallback(async () => {
        try {
            setLoadingTable(true);

            if (selectedRows.length === 0) {
                return;
            }

            const searchParam = searchQuery ? `&search=${encodeURIComponent(searchQuery)}` : "";
            const selectedRowsParam = selectedRows.length > 0 ? `&selectedRows=${JSON.stringify(selectedRows)}` : "";
            const response = await fetch(`/api/history/get-data/?page=${currentPage}${searchParam}${selectedRowsParam}`);
            if (response.ok) {
                const data = await response.json();
                setUsers(data.jobs);
                setTotalPages(data.totalPages);
                setTotalUsers(data.totalJobs);
            } else {
                console.log("Failed to fetch users");
            }
        } catch (error) {
            console.log("Error fetching users:", error);
        } finally {
            setLoadingTable(false);
        }
    }, [currentPage, searchQuery, selectedRows]);

    useEffect(() => {
        fetchUsers();
    }, [currentPage, fetchUsers, searchQuery]);

    const handleGoBack = () => {
        router.back();
    };

    return (
        <div className="flex flex-row h-screen bg-white">
            <Sidebar onStateChange={handleSidebarStateChange} />
            <div
                className={`flex-1 flex flex-col transition-all bg-white duration-300 ${isExpanded ? "ml-64" : "ml-24"
                    }`}
            >
                <div className="flex items-center ml-4">
                    <span className="text-[#005B97] cursor-pointer" onClick={handleGoBack}>
                        <FaArrowLeftLong size={25} />
                    </span>
                    <Header
                        leftContent="History"
                        totalContent={totalUsers}
                        rightContent={
                            <input
                                type="text"
                                placeholder="Search..."
                                className="px-4 py-2 rounded-lg border border-gray-300"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        }
                        buttonContent={''}

                    />
                </div>

                <div className="flex-1 p-4 bg-white">

                    {loadingTable ? (
                        <div className="flex justify-center items-center">
                            <Spinner />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center mt-20">
                            <Image
                                src="/images/no_history.svg"
                                alt="No jobs found"
                                width={200}
                                height={200}
                                priority
                                style={{ width: "auto", height: "auto" }}
                            />
                        </div>
                    ) : (
                        <table className="min-w-full bg-white border-gray-300">
                            <thead>
                                <tr className="text-lg text-gray-800">
                                    <th className="py-2 px-4 border-b text-start font-medium">BL Number</th>
                                    <th className="py-2 px-4 border-b text-center font-medium">Recognition status</th>
                                    <th className="py-2 px-4 border-b text-center font-medium">Changed On</th>
                                    <th className="py-2 px-4 border-b text-center font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((history: History) => (
                                    <tr key={history._id} className="text-gray-500">
                                        <td className="py-2 px-4 border-b text-start">{history.blNumber}</td>
                                        <td className="py-2 px-4 border-b text-center">
                                            <div
                                                className={`inline-flex items-center justify-center gap-0 px-4 py-2 rounded-full text-sm font-medium ${history.recognitionStatus === "new"
                                                    ? "bg-blue-100 text-blue-600"
                                                    : history.recognitionStatus === "inProgress"
                                                        ? "bg-yellow-100 text-yellow-600"
                                                        : history.recognitionStatus === "valid"
                                                            ? "bg-green-100 text-green-600"
                                                            : history.recognitionStatus === "partiallyValid"
                                                                ? "bg-[#faf1be] text-[#AF9918]"
                                                                : history.recognitionStatus === "failure"
                                                                    ? "bg-red-100 text-red-600"
                                                                    : history.recognitionStatus === "sent"
                                                                        ? "bg-green-100 text-green-600"
                                                                        : "bg-blue-100 text-[#005B97]"
                                                    }`}
                                            >
                                                <div className="flex items-center">
                                                    <span>
                                                        {history.recognitionStatus}
                                                    </span>
                                                </div>
                                            </div>

                                        </td>
                                        <td className="py-2 px-4 border-b text-center">
                                            {history.updatedAt ? (() => {
                                                const date = new Date(history.updatedAt);
                                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                                const day = String(date.getDate()).padStart(2, '0');
                                                const year = date.getFullYear();
                                                const hours = String(date.getHours()).padStart(2, '0');
                                                const minutes = String(date.getMinutes()).padStart(2, '0');
                                                const seconds = String(date.getSeconds()).padStart(2, '0');

                                                return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
                                            })() : 'N/A'}
                                        </td>
                                        <td className="py-2 px-4 border-b text-center">
                                            <Link
                                                className="underline text-[#005B97] text-center"
                                                href={`/history/${history._id}?blNumber=${encodeURIComponent(history.blNumber)}`}
                                            >
                                                View Details
                                            </Link>
                                        </td>


                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {loadingTable || totalPages === 0 || users.length === 0 ? null : (
                        <div className="mt-4 flex justify-end items-center gap-4 text-gray-800">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`px-4 py-2 rounded-md ${currentPage === 1
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
                                className={`px-4 py-2 rounded-md ${currentPage === totalPages
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
    );
}
