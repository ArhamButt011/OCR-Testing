"use client";

import { useAuth } from "../hooks/useAuth";
import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import LoadingSpinner from "../components/LoadingSpinner";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function DBConnectionPage() {
  const { isAuthenticated, userRole, loading } = useAuth("/admin-login");
  const [systemID, setSystemID] = useState("");
  const [userName, setUserName] = useState("");
  const [dataBase, setDataBase] = useState("local");
  const [password, setPassword] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [portNumber, setPortNumber] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [checkbox, setCheckBox] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [buttonloading, setButttonLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [percentage, setPercentage] = useState(0);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated || userRole !== "admin") {
        router.push("/admin-login");
      }
    }
  }, [loading, isAuthenticated, userRole, router]);

  useEffect(() => {
    const fetchExistingData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication required. Please log in.");
        router.push("/admin-login");
        return;
      }

      const res = await fetch("/api/auth/db", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const { data } = await res.json();
        if (data) {
          setSystemID(data.systemID || "");
          setUserName(data.userName || "");
          setPassword(data.password || "");
          setIpAddress(data.ipAddress || "");
          setPortNumber(data.portNumber || "");
          setServiceName(data.serviceName || "");
          setDataBase(data.dataBase || "");
          setCheckBox(data.checkbox || false);
        }
      }
    };

    fetchExistingData();
  }, [router]);

  const validateForm = () => {
    if (!systemID.trim()) return "System ID is required.";
    if (!userName.trim()) return "User Name is required.";
    if (!/^[a-zA-Z0-9_]{1,30}$/.test(userName))
      return "User Name must be between 1 and 30 characters and contain only alphanumeric characters or underscores.";
    if (!password.trim()) return "Password is required.";
    if (
      !ipAddress.trim() ||
      !/^[\d.]+$/.test(ipAddress) ||
      !/^(\d{1,3}\.){3}\d{1,3}$/.test(ipAddress)
    ) {
      return "Invalid IP Address. Ensure it contains only numbers, dots, and is properly formatted (e.g., 192.168.1.1).";
    }
    const portNumberParsed = parseInt(portNumber, 10);
    if (
      !portNumber.trim() ||
      isNaN(portNumberParsed) ||
      portNumberParsed <= 0 ||
      portNumberParsed > 65535
    )
      return "Port Number must be a valid number between 1 and 65535.";
    if (!serviceName.trim()) return "Service Name is required.";
    if (!/^[a-zA-Z0-9_]+$/.test(serviceName))
      return "Service Name can only contain alphanumeric characters and underscores.";
    return null;
  };
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!checkbox) {
      setButttonLoading(true);
      router.push("/jobs");

      const token = localStorage.getItem("token");

      if (!token) {
        setError("You are not authenticated. Please log in again.");
        return;
      }

      console.log("api called");
      console.log("db-> ", dataBase);

      const res = await fetch("/api/auth/db", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          systemID,
          userName,
          password,
          ipAddress,
          portNumber,
          serviceName,
          dataBase,
          checkbox,
        }),
      });

      await res.json();

      // if (!res.ok) {
      //     throw new Error(data.message || "Failed to connect to the database");
      // }
      return;
    }

    if (checkbox) {
      const validationError = validateForm();
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    // Start progress bar
    setIsLoading(true);
    setPercentage(0);
    setLoadingComplete(false);
  };

  useEffect(() => {
    if (isLoading) {
      let progress = 0;
      const interval = setInterval(() => {
        if (progress < 100) {
          progress += 10;
          setPercentage(progress);
        } else {
          clearInterval(interval);
          setLoadingComplete(true);
        }
      }, 800);

      return () => clearInterval(interval);
    }
  }, [isLoading]);

  // API call AFTER progress reaches 100%
  useEffect(() => {
    if (loadingComplete) {
      // console.log("⏳ Sending data to backend...");

      const sendDBConnection = async () => {
        try {
          setError(null);
          const token = localStorage.getItem("token");

          if (!token) {
            setError("You are not authenticated. Please log in again.");
            return;
          }

          const res = await fetch("/api/auth/db", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              systemID,
              userName,
              password,
              ipAddress,
              portNumber,
              serviceName,
              dataBase,
              checkbox,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            throw new Error(
              data.message || "Failed to connect to the database"
            );
          }

          Swal.fire({
            icon: "success",
            title: "Success",
            text: "Database connection saved successfully!",
            timer: 3000,
            showConfirmButton: false,
          });

          router.push("/jobs");
        } catch (err: unknown) {
          setError(
            err instanceof Error ? err.message : "An unexpected error occurred"
          );

          Swal.fire({
            icon: "error",
            title: "DB connection fails",
            text:
              err instanceof Error
                ? err.message
                : "An error occurred while connecting to your DB.",
            confirmButtonColor: "#005B97",
            confirmButtonText: "Try Again",
          });
        } finally {
          setIsLoading(false);
        }
      };

      sendDBConnection();
    }
  }, [loadingComplete]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[url('/images/bg.jpg')] bg-cover bg-center">
      <div className="w-full max-w-md bg-white rounded-sm shadow-lg px-6 pb-2 pt-1 mx-5 mb-5 mt-1">
        <h1 className="text-2xl font-bold text-center mb-0 text-black">
          DB Connection
        </h1>
        {isLoading ? (
          <LoadingSpinner percentage={percentage} />
        ) : (
          <form onSubmit={handleSubmit}>
            {/* <div className="mb-3 text-center text-gray-400">
                            <p>If unchecked, connects through API, not DB</p>
                        </div> */}

            {error && <p className="text-red-500 text-center mb-3">{error}</p>}

            <div className="mb-3">
              <label className="block text-black font-semibold">
                System ID
              </label>
              <input
                type="text"
                placeholder="Enter System ID"
                value={systemID}
                onChange={(e) => setSystemID(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                required
              />
            </div>

            <div className="mb-3">
              <label className="block text-black font-semibold">
                User Name
              </label>
              <input
                type="text"
                placeholder="Enter User Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                required
              />
            </div>

            <div className="mb-3">
              <label className="block text-black font-semibold">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 mt-1 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? (
                    <FaEye size={20} className="text-[#005B97]" />
                  ) : (
                    <FaEyeSlash size={20} className="text-[#005B97]" />
                  )}
                </button>
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-black font-semibold">
                IP Address
              </label>
              <input
                type="text"
                placeholder="Enter DB IP Address"
                value={ipAddress}
                onChange={(e) => {
                  const newValue = e.target.value.replace(/[^0-9.]/g, "");
                  setIpAddress(newValue);
                }}
                className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                required
              />
            </div>

            <div className="mb-3">
              <label className="block text-black font-semibold">
                Port Number
              </label>
              <input
                type="number"
                placeholder="Enter DB Port Number"
                value={portNumber}
                onChange={(e) => setPortNumber(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                required
              />
            </div>

            <div className="mb-3">
              <label className="block text-black font-semibold">
                Service Name
              </label>
              <input
                type="text"
                placeholder="Enter Service Name"
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97]"
                required
              />
            </div>

            <div className="mb-3">
              <label className="block text-black font-semibold">DB Type</label>
              <select
                value={dataBase}
                onChange={(e) => setDataBase(e.target.value)}
                className="w-full px-4 py-2 mt-1 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#005B97] cursor-pointer"
              >
                <option value="remote">Remote DB</option>
                <option value="local">Local DB</option>
                {/* <option value="api">API</option> */}
              </select>
            </div>

            <div className="mb-4 flex items-center justify-start gap-5">
              <div className="flex items-center">
                <input
                  className="w-4 h-4 text-[#005B97] bg-slate-600 border-gray-300 rounded active:bg-transparent cursor-pointer"
                  type="checkbox"
                  checked={checkbox}
                  onChange={(e) => setCheckBox(e.target.checked)}
                />
              </div>
              <div className="text-gray-800 font-[550]">
                Initiating connection to the system
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#005B97] text-white py-2 px-4 font-bold rounded-md hover:bg-[#005b97f0] transition duration-300"
              disabled={isLoading || buttonloading}
            >
              {isLoading || buttonloading ? "Loading..." : "Save & Continue"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
