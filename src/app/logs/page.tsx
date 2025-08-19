"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "../components/Sidebar";
import { useSidebar } from "../context/SidebarContext";
import Header from "../components/Header";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";

import { IoIosArrowForward } from "react-icons/io";
// import { IoIosInformationCircle } from "react-icons/io";
import { MdDelete } from "react-icons/md";
import { FiSearch } from "react-icons/fi";
import { FaChevronDown } from "react-icons/fa";
import { IoCalendar } from "react-icons/io5";
import TableSpinner from "../components/TableSpinner";

export interface Log {
  _id: string; // MongoDB ObjectId as string
  message: string;
  fileName: string;
  status: string;
  timestamp: string;
  connectionResult: string; // ISO string, if using toISOString()
}

export default function Page() {
  const [isFilterDropDownOpen, setIsFilterDropDownOpen] = useState(true);

  // States For Filteration

  const [fileNameFilter, setFileNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [oracleFilter, setOracleFilter] = useState("");
  const [submittedFilter, setSubmittedFilter] = useState("");
  const [showButton, setShowButton] = useState(false);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [limit, setLimit] = useState<number | "">(100);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loadingTable, setLoadingTable] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [allowPageOneFetch, setAllowPageOneFetch] = useState(false);
  const [applyFilters, setApplyFilters] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fullUrl = window.location.href; // includes protocol, hostname, port, and path
    console.log(fullUrl);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/admin-login");
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

    if (decodedToken.exp < currentTime) {
      localStorage.removeItem("token");
      router.push("/admin-login");
      return;
    }

    if (decodedToken.role !== "admin") {
      router.push("/extracted-data-monitoring");
      return;
    }

    setIsAuthenticated(true);
    setLoadingTable(false);
  }, [router]);

  const { isExpanded } = useSidebar();

  const handleSidebarStateChange = (newState: boolean) => {
    // setIsSidebarExpanded(newState);
    return newState;
  };

  const handlePageChange = (newPage: number) => {
  if (newPage !== currentPage) {
    if (newPage > 1) {
      setAllowPageOneFetch(true);
    }
    setCurrentPage(newPage);
  }
};

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingTable(true);

      const filters = {
        fileName: sessionStorage.getItem("fileName") || "",
        timestamp: sessionStorage.getItem("submittedFilter") || "",
        status: sessionStorage.getItem("statusFilter") || "",
        connectionResult: sessionStorage.getItem("oracleFilter") || "",
      };
      // const PageParam = currentPage.toString();
      // console.log("Current Page:", PageParam);
      const queryParams = new URLSearchParams();
      // queryParams.set("page", currentPage.toString());

      if (filters.fileName) queryParams.set("fileName", filters.fileName);
      if (filters.timestamp)
        queryParams.set("submittedFilter", filters.timestamp);
      if (filters.status) queryParams.set("statusFilter", filters.status);
      if (filters.connectionResult)
        queryParams.set("oracleFilter", filters.connectionResult);

      console.log(queryParams.toString());
      // const searchParam = searchQuery
      //   ? `&search=${encodeURIComponent(searchQuery)}`
      //   : "";
      const response = await fetch(
        `/api/get-logs?page=${currentPage}&${queryParams.toString()}&limit=${limit}`
      );

      console.log("called...");

      if (response.ok) {
        const data = await response.json();
        console.log("data-> ", data);
        setLogs(data.logs);
        setTotalPages(data.totalPages);
        setTotalLogs(data.totalLogs);
      } else {
        console.log("Failed to fetch logs");
      }
    } catch (error) {
      console.log("Error fetching logs:", error);
    } finally {
      setLoadingTable(false);
    }
  }, [currentPage, limit]);
  useEffect(() => {
    if (
      applyFilters ||
      currentPage > 1 ||
      (currentPage === 1 && allowPageOneFetch)
    ) {
      fetchUsers();
      setApplyFilters(false);

      // Reset page-1 fetch flag once it's used
      if (currentPage === 1 && allowPageOneFetch) {
        setAllowPageOneFetch(false);
      }
    }
  }, [applyFilters, currentPage, allowPageOneFetch]);

  useEffect(() => {
    setShowButton(selectedRows.length > 0);
  }, [selectedRows]);

  if (!isAuthenticated) return <p>Access Denied. Redirecting...</p>;

  const isAnyFilterApplied = () => {
    return (
      sessionStorage.getItem("fileName") ||
      sessionStorage.getItem("statusFilter") ||
      sessionStorage.getItem("submittedFilter") ||
      sessionStorage.getItem("oracleFilter")
    );
  };

  const handleFilterApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    console.log("Filters applied:", fileNameFilter);

    sessionStorage.setItem("fileName", fileNameFilter);
    sessionStorage.setItem("statusFilter", statusFilter);
    sessionStorage.setItem("submittedFilter", submittedFilter);
    sessionStorage.setItem("oracleFilter", oracleFilter);

    setCurrentPage(1); // ✅ Reset to first page
    setApplyFilters(true); // ✅ Trigger fetch
  };

  const resetFiltersAndFetch = async () => {
    sessionStorage.setItem("fileName", "");
    sessionStorage.setItem("statusFilter", "");
    sessionStorage.setItem("submittedFilter", "");
    sessionStorage.setItem("oracleFilter", "");
    setFileNameFilter("");
    setStatusFilter("");
    setSubmittedFilter("");
    setOracleFilter("");
    await fetchUsers();
  };

  const handleRouteChange = () => {
    if (typeof window !== "undefined") {
      const filters = {
        fileNameFilter,
        statusFilter,
        submittedFilter,
        oracleFilter,
      };
      Object.entries(filters).forEach(([key, value]) => {
        sessionStorage.setItem(key, value);
      });
    }
  };

  const handleRowSelection = (id: string) => {
    setSelectedRows((prevSelectedRows) =>
      prevSelectedRows.includes(id)
        ? prevSelectedRows.filter((rowId) => rowId !== id)
        : [...prevSelectedRows, id]
    );
  };

  const isAllSelected = selectedRows.length === logs.length && logs.length > 0;
  const handleSelectAll = () => {
    if (selectedRows.length === logs.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(logs.map((log) => log._id));
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
          const response = await fetch("/api/delete-logs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: selectedRows }),
          });

          const result = await response.json();

          if (response.ok) {
            const isLastPage =
              logs.length === selectedRows.length && currentPage > 1;
            if (isLastPage) {
              setCurrentPage((prevPage) => prevPage - 1);
            }

            await fetchUsers();
            setTotalLogs(totalLogs - selectedRows.length);
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

  return (
    <div className="flex flex-row h-screen bg-white">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          !isExpanded ? "ml-24" : "ml-64"
        }`}
      >
        <Header
          leftContent="Total Logs"
          totalContent={totalLogs}
          // rightContent={
          //   <input
          //     type="text"
          //     placeholder="Search user..."
          //     className="px-4 py-2 rounded-lg border border-gray-300"
          //     value={searchQuery}
          //     onChange={(e) => setSearchQuery(e.target.value)}
          //   />
          // }
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
                  </>
                )}
              </div>
            </>
          }
          buttonContent={""}
        />
        <div className="flex-1 p-4 bg-white">
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
                  File Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter File Name"
                    value={fileNameFilter}
                    onChange={(e) => setFileNameFilter(e.target.value)}
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
                  htmlFor="search"
                  className="text-sm font-semibold text-gray-800"
                >
                  Submitted At
                </label>

                <div className="relative">
                  <input
                    id="dateInput"
                    type="date"
                    placeholder="YYYY-MM-DD"
                    value={submittedFilter}
                    onChange={(e) => setSubmittedFilter(e.target.value)}
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
                  Oracle Connection
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Oracle Connection"
                    value={oracleFilter}
                    onChange={(e) => setOracleFilter(e.target.value)}
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
                  Status
                </label>
                <div className="relative">
                  <select
                    id="finalStatusFilter"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none cursor-pointer"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="added">Added</option>
                    <option value="updated">Updated</option>
                    <option value="not_found">Not Found</option>
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
                  Maximum No. of Hits
                </label>
                <div>
                  <input
                    type="text"
                    className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] appearance-none"
                    value={limit}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "") {
                        setLimit("");
                      } else {
                        const parsed = parseInt(e.target.value, 10);
                        if (!isNaN(parsed)) {
                          setLimit(parsed);
                        }
                      }
                    }}
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

          {loadingTable ? (
            <div className="flex justify-center items-center">
              <TableSpinner />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center mt-20">
              <Image
                src="/images/no_request.svg"
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
                <tr className="text-xl text-gray-800">
                  <th className="py-2 px-4 border-b text-start font-medium">
                    <span className="mr-3">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={handleSelectAll}
                      />
                    </span>
                    File Name
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">
                    Message
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">
                    Submitted At
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">
                    Oracle Connection
                  </th>

                  <th className="py-2 px-4 border-b text-center font-medium">
                    Status
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((logs: Log) => (
                  <tr key={logs._id} className="text-gray-600">
                    <td className="py-2 px-4 border-b text-start m-0 sticky left-0 bg-white z-10">
                      <span className="mr-3">
                        <input
                          type="checkbox"
                          checked={selectedRows.includes(logs._id)}
                          onChange={() => handleRowSelection(logs._id)}
                        />
                      </span>
                      <Link
                        href={`/extracted-data-monitoring/${logs._id}`}
                        onClick={() => {
                          handleRouteChange();
                          localStorage.setItem("prev", "");
                        }}
                        className="group"
                      >
                        <span className="text-[#005B97] underline group-hover:text-blue-500 transition-all duration-500 transform group-hover:scale-110">
                          {logs.fileName}
                        </span>
                      </Link>
                    </td>

                    <td className="py-1 px-4 border-b text-center">
                      {logs.message}
                    </td>
                    <td className="py-1 px-4 border-b text-center text-gray-500">
                      {new Date(logs.timestamp).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="py-1 px-4 border-b text-center">
                      {logs.connectionResult}
                    </td>
                    <td className="py-1 px-4 border-b text-center">
                      {logs.status}
                    </td>
                    <td className="py-1 px-4 border-b text-center ">
                      <Link
                        href={`/logs/${logs?._id}`}
                        className="text-[#005B97] hover:underline"
                      >
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {loadingTable || totalPages === 0 || logs.length === 0 ? null : (
            <div className="mt-4 flex justify-end items-center gap-4 text-gray-800">
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
  );
}
