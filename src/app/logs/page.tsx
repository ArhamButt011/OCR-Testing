"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import { useSidebar } from "../context/SidebarContext";
import Header from "../components/Header";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Swal from "sweetalert2";

import { IoIosArrowForward } from "react-icons/io";
import { MdDelete } from "react-icons/md";
import { FiSearch } from "react-icons/fi";
import { FaChevronDown } from "react-icons/fa";
import { IoCalendar } from "react-icons/io5";
import TableSpinner from "../components/TableSpinner";

export interface Log {
  _id: string;
  message: string;
  fileName: string;
  status: string;
  timestamp: string;
  connectionResult: string;
}

interface LiveLogEntry {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  endpoint: string;
  method: string;
  statusCode: number;
  timestamp: string;
  metadata?: {
  duration?: string;
  dataKeys?: string[];
  recordCount?: number;
};
}

interface FormattedLog {
  request_id: string;
  method: string;
  path: string;
  status_code: number;
  event: 'request_completed' | 'request_started';
  logger: string;
  level: LiveLogEntry['type'];
  timestamp: string;
  duration_ms?: number;
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

  // Live Logs States
  const [liveLogs, setLiveLogs] = useState<LiveLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [levelFilter, setLevelFilter] = useState<'all' | 'success' | 'error' | 'warning' | 'info'>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [maxLiveLogs, setMaxLiveLogs] = useState<number>(100);
  const [liveSearchTerm, setLiveSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const pendingLogsRef = useRef<LiveLogEntry[]>([]);

  const router = useRouter();

  useEffect(() => {
    const fullUrl = window.location.href;
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

      const queryParams = new URLSearchParams();

      if (filters.fileName) queryParams.set("fileName", filters.fileName);
      if (filters.timestamp)
        queryParams.set("submittedFilter", filters.timestamp);
      if (filters.status) queryParams.set("statusFilter", filters.status);
      if (filters.connectionResult)
        queryParams.set("oracleFilter", filters.connectionResult);

      console.log(queryParams.toString());

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

      if (currentPage === 1 && allowPageOneFetch) {
        setAllowPageOneFetch(false);
      }
    }
  }, [applyFilters, currentPage, allowPageOneFetch, fetchUsers]);

  useEffect(() => {
    setShowButton(selectedRows.length > 0);
  }, [selectedRows]);

  // Live Logs SSE Connection
  useEffect(() => {
    if (!isAuthenticated) return;

    console.log('🔌 Connecting to SSE endpoint...');
    
    const eventSource = new EventSource('/api/logs-stream');
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('✅ Connected to log stream');
      setIsConnected(true);
    };

    eventSource.onerror = (error) => {
      console.error('❌ SSE Connection error:', error);
      setIsConnected(false);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'history') {
          setLiveLogs(data.logs.slice(-maxLiveLogs));
        } else if (data.type === 'log') {
          if (isPaused) {
            pendingLogsRef.current.push(data.log);
          } else {
            setLiveLogs(prev => {
              const updated = [...prev, data.log];
              return updated.slice(-maxLiveLogs);
            });
          }
        }
      } catch (error) {
        console.error('❌ Failed to parse log data:', error);
      }
    };

    return () => {
      console.log('🔌 Disconnecting from log stream');
      eventSource.close();
    };
  }, [isPaused, maxLiveLogs, isAuthenticated]);

  useEffect(() => {
    if (autoScroll && !isPaused) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs, autoScroll, isPaused]);

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

    setCurrentPage(1);
    setApplyFilters(true);
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

  const clearLiveLogs = async () => {
    try {
      await fetch('/api/logs-clear', { method: 'POST' });
      setLiveLogs([]);
      pendingLogsRef.current = [];
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const togglePause = () => {
    setIsPaused(prev => {
      if (prev) {
        setLiveLogs(current => {
          const combined = [...current, ...pendingLogsRef.current];
          return combined.slice(-maxLiveLogs);
        });
        pendingLogsRef.current = [];
      }
      return !prev;
    });
  };

  const services = Array.from(new Set(liveLogs.map(log => {
    const parts = log.endpoint.split('/');
    return parts[2] || 'unknown';
  })));

  const filteredLiveLogs = liveLogs.filter(log => {
    const matchesLevel = levelFilter === 'all' || log.type === levelFilter;
    const matchesService = serviceFilter === 'all' || log.endpoint.includes(`/api/${serviceFilter}`);
    const matchesSearch = liveSearchTerm === '' || 
      log.message.toLowerCase().includes(liveSearchTerm.toLowerCase()) ||
      log.endpoint.toLowerCase().includes(liveSearchTerm.toLowerCase());
    return matchesLevel && matchesService && matchesSearch;
  });

  const liveStats = {
    total: liveLogs.length,
    errors: liveLogs.filter(l => l.type === 'error').length,
    warnings: liveLogs.filter(l => l.type === 'warning').length,
    info: liveLogs.filter(l => l.type === 'info' || l.type === 'success').length,
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getLogBadgeColor = (type: LiveLogEntry['type']) => {
    const colors = {
      success: 'bg-blue-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      info: 'bg-blue-500',
    };
    return colors[type];
  };

  // const getLogIcon = (type: LiveLogEntry['type']) => {
  //   const icons = {
  //     success: 'ℹ️',
  //     error: '❌',
  //     warning: '⚠️',
  //     info: 'ℹ️',
  //   };
  //   return icons[type];
  // };

  const formatLogData = (log: LiveLogEntry) => {
    const data: FormattedLog = {
      request_id: log.id.split('-')[0],
      method: log.method,
      path: log.endpoint,
      status_code: log.statusCode,
      event: log.type === 'success' ? 'request_completed' : 'request_started',
      logger: 'app',
      level: log.type,
      timestamp: log.timestamp,
    };

   if (log.metadata?.duration) {
  data.duration_ms = parseFloat(log.metadata.duration);
}

    return JSON.stringify(data);
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
        <div className="flex-1 p-4 bg-white overflow-y-auto">
          {/* Existing Filters */}
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
                  type="button"
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

          {/* Existing Table */}
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

          {/* DIVIDER */}
          <div className="my-8 border-t-2 border-gray-300"></div>

          {/* LIVE API LOGS SECTION */}
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Live API Response Logs</h2>
            
            {/* Live Logs Filter Controls */}
            <div className="bg-gray-200 p-4 rounded-lg mb-4">
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 max-w-xs">
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={liveSearchTerm}
                    onChange={(e) => setLiveSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border text-gray-700 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm placeholder:text-gray-700"
                  />
                  <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Level Filter */}
                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm bg-white"
                >
                  <option value="all">All Levels</option>
                  <option value="error">Error</option>
                  <option value="warning">Warning</option>
                  <option value="success">Info</option>
                </select>

                {/* Service Filter */}
                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm bg-white"
                >
                  <option value="all">All Services</option>
                  {services.map(service => (
                    <option key={service} value={service}>{service}</option>
                  ))}
                </select>

                {/* Max Logs */}
                <select
                  value={maxLiveLogs}
                  onChange={(e) => setMaxLiveLogs(Number(e.target.value))}
                  className="px-4 py-2 border text-gray-700 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#005B97] text-sm bg-white"
                >
                  <option value={50}>50 logs</option>
                  <option value={100}>100 logs</option>
                  <option value={200}>200 logs</option>
                  <option value={500}>500 logs</option>
                  <option value={1000}>1000 logs</option>
                </select>

                {/* Pause Button */}
                <button
                  onClick={togglePause}
                  className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition ${
                    isPaused ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  {isPaused ? '▶ Resume' : '⏸ Pause'}
                </button>

                {/* Clear Button */}
                <button
                  onClick={clearLiveLogs}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition"
                >
                  <span className="flex items-center gap-1">
                 <MdDelete className="fill-[white] text-lg transition-transform transform group-hover:scale-110 group-hover:duration-300" />Clear
                 </span>
                </button>
              </div>

              {/* Stats */}
              <div className="flex items-center justify-between gap-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{liveStats.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{liveStats.errors}</div>
                  <div className="text-xs text-gray-500">Errors</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">{liveStats.warnings}</div>
                  <div className="text-xs text-gray-500">Warnings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{liveStats.info}</div>
                  <div className="text-xs text-gray-500">Info</div>
                </div>
                <div className="text-centerd">
                  <div className={`text-xl font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {isConnected ? 'Live' : 'Disconnected'}
                  </div>
                  <div className="text-xs text-gray-500">Status</div>
                </div>
              </div>
            </div>

            {/* Live Logs List */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 max-h-[600px] overflow-y-auto">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-gray-50 pb-2 z-10">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className="text-sm font-semibold text-gray-700">Live Logs ({liveLogs.length})</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-gray-600">Auto-scroll</span>
                </label>
              </div>

              {filteredLiveLogs.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p className="text-lg">{liveSearchTerm ? 'No logs match your search' : 'No logs to display'}</p>
                  <p className="text-sm mt-2">Make some API calls to see logs appear here</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLiveLogs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition"
                    >
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                        {/* <span className="text-base">{getLogIcon(log.type)}</span> */}
                        <span className="text-xs text-gray-500">{formatTimestamp(log.timestamp)}</span>
                        <span className="text-xs text-gray-600">backend</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium text-white ${getLogBadgeColor(log.type)}`}>
                          {log.type === 'success' ? 'INFO' : log.type === 'error' ? 'ERROR' : log.type === 'warning' ? 'WARNING' :''}
                        </span>
                      </div>

                      <div className="px-4 py-3">
                        <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words">
                          {formatLogData(log)}
                        </pre>
                      </div>

                      <details className="px-4 pb-3">
                        <summary className="text-xs text-[#005B97] cursor-pointer hover:text-blue-700">
                          View Details
                        </summary>
                        <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-3 rounded">
                          {JSON.stringify({
                            message: log.message,
                            endpoint: log.endpoint,
                            method: log.method,
                            statusCode: log.statusCode,
                            metadata: log.metadata,
                          }, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}