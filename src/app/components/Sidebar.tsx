"use client";

import { useState, useRef, useEffect } from "react";
import Cookie from "js-cookie";
import Link from "next/link";
import Image from "next/image";
import sideBarLogo from "../../../public/images/sidbar.svg";
import { usePathname } from "next/navigation";
import { FaClipboardList, FaHistory, FaUserPlus } from "react-icons/fa";
import { BsClipboard2CheckFill } from "react-icons/bs";
import { IoSettingsSharp, IoLogOut } from "react-icons/io5";
import { IoIosArrowForward } from "react-icons/io";
import { RiArrowDropDownLine, RiTimeZoneFill } from "react-icons/ri";
import { FaHouseSignal } from "react-icons/fa6";
import { TbCloudDataConnection } from "react-icons/tb";
import { useRouter } from "next/navigation";
import { IoIosArrowDroprightCircle } from "react-icons/io";
import { useSidebar } from "../context/SidebarContext";
import { CiBoxList } from "react-icons/ci";

interface SidebarProps {
  onStateChange: (newState: boolean) => void;
}

export default function Sidebar({ onStateChange }: SidebarProps) {
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [isAutoConfirmationOpen, setAutoConfirmationOpen] = useState(false);
  const [isDropdownOpenZone, setIsDropdownOpenZone] = useState(false);
  const [selectedTimeZone, setSelectedTimeZone] = useState("UTC+00:00");
  const [userName, setUserName] = useState("User");
  const [userRole, setUserRole] = useState("");
  const router = useRouter();
  const { isExpanded, toggleSidebar } = useSidebar();
  const [isImageLoaded, setIsImageLoaded] = useState(true);

  const [secondaryIp, setSecondaryIp] = useState("");

  const [ip, setIp] = useState("");
  const [remember, setRemember] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // const [wmsUrl, setWmsUrl] = useState("");
  const [username, setUsername] = useState("");
  const [hostName, setHostName] = useState("");
  const [port, setPort] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // const [originalUrl, setOriginalUrl] = useState(""); // Store the fetched URL
  const [originalUsername, setOriginalUsername] = useState("");
  const [originalPassword, setOriginalPassword] = useState("");
  const [originalHostName, setOriginalHostName] = useState(""); // Store the fetched URL
  const [originalPort, setOriginalPort] = useState("");
  const [originalServiceName, setOriginalServiceName] = useState("");

  const [isInputActive, setIsInputActive] = useState(false); // Track input foc
  const [dataBase, setDataBase] = useState("local");
  console.log(dataBase);
  const [status, setStatus] = useState<"online" | "offline" | "loading">(
    "loading"
  );

  useEffect(() => {
    const fetchExistingData = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
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
          setDataBase(data.dataBase || "");
        }
      }
    };

    fetchExistingData();
  }, []);

  useEffect(() => {
    const fetchWmsUrl = async () => {
      try {
        const response = await fetch("/api/save-wms-url");
        const data = await response.json();
        console.log("data-> ", data);
        if (response.ok) {
          // setWmsUrl(data.wmsUrl);
          // setOriginalUrl(data.wmsUrl);
          setUsername(data.username || "");
          setHostName(data.hostName || "");
          setOriginalUsername(data.username || "");
          setOriginalHostName(data.hostName || "");
          setPort(data.port || "");
          setOriginalPort(data.port || "");
          setServiceName(data.serviceName || "");
          setOriginalServiceName(data.serviceName || "");
          setPassword(data.password || "");
          setOriginalPassword(data.password || "");
        }
      } catch (error) {
        console.error("Error fetching WMS URL:", error);
      }
    };

    fetchWmsUrl();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/save-wms-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          hostName,
          port,
          serviceName,
        }),
      });

      if (response.ok) {
        setSaved(true);
        // setOriginalUrl(wmsUrl);
        setOriginalUsername(username);
        setOriginalPassword(password);
        setOriginalHostName(hostName);
        setOriginalPort(port);
        setOriginalServiceName(serviceName);

        // Hide success message after 3 sec
        setTimeout(() => setSaved(false), 3000);
      } else {
        console.error("Failed to save WMS URL");
      }
    } catch (error) {
      console.error("Error saving WMS URL:", error);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const preloadImage = new window.Image();
    preloadImage.src = "/images/sidbar.svg";
    preloadImage.onload = () => setIsImageLoaded(true);
  }, []);

  useEffect(() => {
    fetch("/api/ipAddress/ip-address")
      .then((res) => res.json())
      .then((data) => {
        if (data.ip) {
          setIp(data.ip);
          setSecondaryIp(data.secondaryIp);
          setRemember(data.remember);
        }
      })
      .catch((err) => console.error("Failed to fetch IP:", err));
  }, []);

  const handleSaveIP = async () => {
    if (!ip || !secondaryIp) return alert("Please enter an both IP address");

    await fetch("/api/ipAddress/ip-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip, secondaryIp, remember }),
    });

    setIsEditing(false);
  };

  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleExpand = () => {
    toggleSidebar();
    onStateChange(isExpanded);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/admin-login");
      return;
    }

    const savedRole = localStorage.getItem("role");
    if (savedRole) {
      setUserRole(savedRole);
    } else {
      const decodedToken = decodeJwt(token);
      const role = decodedToken.role;
      setUserRole(role);
      localStorage.setItem("role", role);
    }

    if (typeof window !== "undefined") {
      const username = localStorage.getItem("username");
      setUserName(username || "User");
    }
  }, [router]);

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

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await fetch("/api/oracle/health");
        const data = await res.json();
        setStatus(data.status === "online" ? "online" : "offline");
      } catch (error) {
        console.error("Error checking Oracle status:", error);
        setStatus("offline");
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, []);

  const getDotColor = () => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "offline":
        return "bg-red-500";
      case "loading":
        return "bg-yellow-500 animate-pulse";
    }
  };

  const toggleAutoConfirmation = async () => {
    try {
      const newStatus = !isAutoConfirmationOpen;
      setAutoConfirmationOpen(newStatus);
      await fetch("/api/settings/auto-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAutoConfirmationOpen: newStatus }),
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/settings/auto-confirmation");
        const data = await res.json();
        setAutoConfirmationOpen(data.isAutoConfirmationOpen);
      } catch (error) {
        console.error("Error fetching status:", error);
      }
    };

    fetchStatus();
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        localStorage.setItem("sidebar", JSON.stringify(false));
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        localStorage.removeItem("role");
        Cookie.remove("token");
        Cookie.remove("role");
        Cookie.remove("username");

        if (userRole === "admin") {
          window.location.href = "/admin-login";
        } else {
          window.location.href = "/login";
        }
      } else {
        const errorData = await response.json();
        console.log(errorData);
      }
    } catch (error) {
      console.log("Error during logout:", error);
    }
  };

  const timeZones = [
    "UTC-12:00",
    "UTC-11:00",
    "UTC-10:00",
    "UTC-09:00",
    "UTC-08:00",
    "UTC-07:00",
    "UTC-06:00",
    "UTC-05:00",
    "UTC-04:00",
    "UTC-03:00",
    "UTC-02:00",
    "UTC-01:00",
    "UTC+00:00",
    "UTC+01:00",
    "UTC+02:00",
    "UTC+03:00",
    "UTC+04:00",
    "UTC+05:00",
    "UTC+06:00",
    "UTC+07:00",
    "UTC+08:00",
    "UTC+09:00",
    "UTC+10:00",
    "UTC+11:00",
    "UTC+12:00",
  ];

  const handleSelectTimeZone = (zone: string) => {
    setSelectedTimeZone(zone);
    setIsDropdownOpenZone(false);
  };

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  const pathname = usePathname();
  // const isActive = (path: string) => pathname === path;

  const isActive = (path: string) => {
    return pathname?.startsWith(path);
  };

  return (
    <>
      <div
        className={`fixed top-0 left-0 bg-gray-100 text-gray-800 h-screen z-30 transform transition-all duration-300 ease-in-out ${
          !isExpanded ? "w-24" : "w-64"
        } flex flex-col justify-between`}
      >
        <div className="flex items-center justify-center h-20 bg-gray-100">
          {isExpanded && isImageLoaded ? (
            <Image
              src={sideBarLogo}
              alt="Sidebar Logo"
              width={200}
              height={200}
              priority
              style={{ width: "auto", height: "auto" }}
            />
          ) : (
            <p className="text-2xl font-bold text-[#005B97]">MPG</p>
          )}
        </div>

        <nav className="mt-8 flex-grow p-4 bg-gray-100">
          <ul className="space-y-4">
            {userRole === "admin" && (
              <Link href="/jobs">
                <li
                  className={`flex items-center mb-2 justify-start
                                     space-x-3 pl-5 pr-0 py-2 rounded-lg transition-all duration-300 ease-in-out ${
                                       isActive("/jobs")
                                         ? "bg-gray-200"
                                         : "hover:bg-gray-200"
                                     }`}
                >
                  <span className="flex-shrink-0">
                    <BsClipboard2CheckFill
                      className={` ${
                        isActive("/jobs") ? "text-[#005B97]" : "text-[#7B849A]"
                      } transition-all duration-300 ease-in-out text-2xl`}
                    />
                  </span>
                  <span
                    className={`${
                      isActive("/jobs") ? " text-gray-950" : "text-gray-400"
                    } text-lg transition-all duration-300 ease-in-out`}
                    style={{
                      width: isExpanded ? "auto" : "0",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      opacity: isExpanded ? 1 : 0,
                      transition: "opacity 0.3s ease, width 0.3s ease",
                    }}
                  >
                    Jobs
                  </span>
                </li>
              </Link>
            )}
            <Link
              href="/extracted-data-monitoring"
              onClick={() => localStorage.setItem("prev", "/roles-requests")}
            >
              <li
                className={`flex items-center mb-2 justify-start
                                     space-x-3 pl-5 pr-0 py-2 rounded-lg transition-all duration-300 ease-in-out ${
                                       isActive("/extracted-data-monitoring") ||
                                       isActive("/history")
                                         ? "bg-gray-200"
                                         : "hover:bg-gray-200"
                                     }`}
              >
                <span className="flex-shrink-0">
                  <FaClipboardList
                    className={` ${
                      isActive("/extracted-data-monitoring") ||
                      isActive("/history")
                        ? "text-[#005B97]"
                        : "text-[#7B849A]"
                    } transition-all duration-300 ease-in-out text-2xl`}
                  />
                </span>
                <span
                  className={`${
                    isActive("/extracted-data-monitoring") ||
                    isActive("/history")
                      ? " text-gray-950"
                      : "text-gray-400"
                  }  text-lg transition-all duration-300 ease-in-out`}
                  style={{
                    width: isExpanded ? "auto" : "0",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    opacity: isExpanded ? 1 : 0,
                    transition: "opacity 0.3s ease, width 0.3s ease",
                  }}
                >
                  Extracted Data
                </span>
              </li>
            </Link>
            {userRole === "admin" && (
              <Link href="/roles-requests">
                <li
                  className={`flex items-center mb-2 justify-start
                                     space-x-3 pl-5 pr-0 py-2 rounded-lg transition-all duration-300 ease-in-out ${
                                       isActive("/roles-requests")
                                         ? "bg-gray-200"
                                         : "hover:bg-gray-200"
                                     }`}
                >
                  <span className="flex-shrink-0">
                    <FaUserPlus
                      className={` ${
                        isActive("/roles-requests")
                          ? "text-[#005B97]"
                          : "text-[#7B849A]"
                      } transition-all duration-300 ease-in-out text-2xl`}
                    />
                  </span>
                  <span
                    className={`${
                      isActive("/roles-requests")
                        ? " text-gray-950"
                        : "text-gray-400"
                    } text-lg transition-all duration-300 ease-in-out`}
                    style={{
                      width: isExpanded ? "auto" : "0",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      opacity: isExpanded ? 1 : 0,
                      transition: "opacity 0.3s ease, width 0.3s ease",
                    }}
                  >
                    Roles Requests
                  </span>
                </li>
              </Link>
            )}

            {userRole === "admin" && (
              <Link href="/logs">
                <li
                  className={`flex items-center mb-2 justify-start
                                     space-x-3 pl-5 pr-0 py-2 rounded-lg transition-all duration-300 ease-in-out ${
                                       isActive("/logs")
                                         ? "bg-gray-200"
                                         : "hover:bg-gray-200"
                                     }`}
                >
                  <span className="flex-shrink-0">
                    <FaHistory
                      className={` ${
                        isActive("/logs") ? "text-[#005B97]" : "text-[#7B849A]"
                      } transition-all duration-300 ease-in-out text-2xl`}
                    />
                  </span>
                  <span
                    className={`${
                      isActive("/logs") ? " text-gray-950" : "text-gray-400"
                    } text-lg transition-all duration-300 ease-in-out`}
                    style={{
                      width: isExpanded ? "auto" : "0",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      opacity: isExpanded ? 1 : 0,
                      transition: "opacity 0.3s ease, width 0.3s ease",
                    }}
                  >
                    Logs
                  </span>
                </li>
              </Link>
            )}
            {userRole === "admin" && (
              <Link href="/pod-ocr">
                <li
                  className={`flex items-center mb-2 justify-start
                                     space-x-3 pl-5 pr-0 py-2 rounded-lg transition-all duration-300 ease-in-out ${
                                       isActive("/pod-ocr")
                                         ? "bg-gray-200"
                                         : "hover:bg-gray-200"
                                     }`}
                >
                  <span className="flex-shrink-0">
                    <CiBoxList
                      className={` ${
                        isActive("/pod-ocr")
                          ? "text-[#005B97]"
                          : "text-[#7B849A]"
                      } transition-all duration-300 ease-in-out text-2xl`}
                    />
                  </span>
                  <span
                    className={`${
                      isActive("/pod-ocr") ? " text-gray-950" : "text-gray-400"
                    } text-lg transition-all duration-300 ease-in-out`}
                    style={{
                      width: isExpanded ? "auto" : "0",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      opacity: isExpanded ? 1 : 0,
                      transition: "opacity 0.3s ease, width 0.3s ease",
                    }}
                  >
                    POD
                  </span>
                </li>
              </Link>
            )}
          </ul>
        </nav>

        <div className="p-4 bg-gray-100 mt-auto">
          {userRole === "admin" && (
            <ul className="mb-5 relative">
              <li
                className={`flex items-center justify-start pl-5 pr-0 py-2 rounded-lg transition-all duration-300 ease-in-out`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0">
                    <IoSettingsSharp
                      className="text-[#7B849A] text-2xl cursor-pointer"
                      onClick={toggleDropdown}
                    />
                  </span>
                  <span
                    className={`text-gray-800 text-lg transition-opacity duration-300 ease-in-out cursor-pointer ${
                      isExpanded ? "opacity-100 visible" : "opacity-0 invisible"
                    }`}
                    style={{
                      width: isExpanded ? "auto" : "0px",
                      overflow: "hidden",
                      whiteSpace: "nowrap",
                      transition: "opacity 0.3s ease, width 0.3s ease",
                    }}
                    onClick={toggleDropdown}
                  >
                    Settings
                  </span>
                </div>
                <span
                  className={`transition-transform ml-20 duration-300 ease-in-out cursor-pointer ${
                    isExpanded ? "opacity-100 visible" : "opacity-0 invisible"
                  }`}
                  onClick={toggleDropdown}
                >
                  <IoIosArrowForward className="text-lg text-gray-600" />
                </span>
              </li>
            </ul>
          )}

          {isDropdownOpen && (
            <>
              {userRole !== "admin" && (
                <div
                  ref={dropdownRef}
                  className={`absolute ${
                    isExpanded ? "left-56 bottom-18" : "left-16 bottom-16"
                  }  w-32 bg-white rounded-lg shadow-xl`}
                >
                  <ul className="text-gray-600">
                    <li className="p-2 cursor-pointer">
                      <p
                        onClick={handleLogout}
                        className="flex justify-start gap-3 items-center transform transition-transform hover:translate-x-2"
                      >
                        <IoLogOut className="text-[#005B97] text-2xl" />
                        <span className="font-medium text-[#005B97]">
                          Logout
                        </span>
                      </p>
                    </li>
                  </ul>
                </div>
              )}

              {userRole === "admin" && (
                <div
                  ref={dropdownRef}
                  className={`absolute  ${
                    isExpanded ? "left-60 bottom-24" : "left-16 bottom-24"
                  }  w-80 bg-white rounded-lg shadow-xl`}
                >
                  <h1 className="mt-1 p-2 text-xl font-medium">Settings</h1>
                  <ul className="text-gray-600 mt-2">
                    <li className="p-2 relative border-b">
                      <div className="flex justify-between items-center">
                        <span>Time Zone</span>
                        <div
                          className="cursor-pointer bg-gray-100 py-1 px-3 rounded-lg flex items-center justify-between gap-2"
                          onClick={() =>
                            setIsDropdownOpenZone(!isDropdownOpenZone)
                          }
                        >
                          <span className="flex items-center justify-start">
                            {selectedTimeZone ? (
                              selectedTimeZone
                            ) : (
                              <RiTimeZoneFill className="text-[#005B97] text-2xl" />
                            )}
                          </span>
                          <RiArrowDropDownLine
                            size={30}
                            className={`p-0 transform transition-transform text-[#005B97] duration-300 ease-in-out ${
                              isDropdownOpenZone ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                      <div
                        className={`absolute mt-2 left-40 w-40 bg-white border rounded-lg shadow-lg z-10 overflow-y-auto max-h-48 transform transition-all duration-300 ease-in-out ${
                          isDropdownOpenZone
                            ? "opacity-100 scale-100"
                            : "opacity-0 scale-95 pointer-events-none"
                        }`}
                      >
                        <ul>
                          {timeZones.map((zone) => (
                            <li
                              key={zone}
                              onClick={() => handleSelectTimeZone(zone)}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            >
                              {zone}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>

                    <li className="p-2 hover:bg-gray-200 cursor-pointer border-b w-full">
                      <p className="flex flex-wrap md:flex-nowrap justify-between items-center gap-2">
                        <span className="text-sm md:text-base">
                          GPU IP Address
                        </span>

                        <span className="flex-1">
                          <input
                            type="text"
                            className="w-full bg-gray-100 py-1 px-2 rounded-lg border-0 outline-none text-sm md:text-base"
                            value={ip}
                            placeholder="192.158.1.38"
                            onChange={(e) => {
                              setIp(e.target.value);
                              setIsEditing(true);
                            }}
                            onFocus={() => setIsEditing(true)}
                            onBlur={() => {
                              setTimeout(() => {
                                if (
                                  !document.getElementById("app-ip") ||
                                  (document.activeElement !==
                                    document.getElementById("app-ip") &&
                                    document.activeElement !==
                                      document.getElementById("gpu-ip"))
                                ) {
                                  setIsEditing(false);
                                }
                              }, 200);
                            }}
                            id="gpu-ip"
                          />
                        </span>

                        <span className="flex items-center">
                          <input
                            type="checkbox"
                            id="remember-ip"
                            className="mr-2"
                            checked={remember}
                            onChange={() => {
                              setRemember(!remember);
                              if (!isEditing) setIsEditing(true);
                            }}
                          />
                        </span>
                      </p>

                      <p className="flex flex-wrap md:flex-nowrap justify-between items-center gap-2 mt-2">
                        <span className="text-sm md:text-base">
                          App IP Address
                        </span>

                        <span className="flex-1">
                          <input
                            type="text"
                            className="w-full bg-gray-100 py-1 px-2 rounded-lg border-0 outline-none text-sm md:text-base"
                            value={secondaryIp}
                            placeholder="192.168.1.20"
                            onChange={(e) => {
                              setSecondaryIp(e.target.value);
                              setIsEditing(true);
                            }}
                            onFocus={() => setIsEditing(true)}
                            onBlur={() => {
                              setTimeout(() => {
                                if (
                                  !document.getElementById("gpu-ip") ||
                                  (document.activeElement !==
                                    document.getElementById("app-ip") &&
                                    document.activeElement !==
                                      document.getElementById("gpu-ip"))
                                ) {
                                  setIsEditing(false);
                                }
                              }, 200);
                            }}
                            id="app-ip"
                          />
                        </span>

                        <span className="flex items-center">
                          <input
                            type="checkbox"
                            id="remember-ip"
                            className="mr-2"
                            checked={remember}
                            disabled={true}
                          />
                        </span>
                      </p>

                      {isEditing && (
                        <div className="w-full flex justify-end mt-2">
                          <button
                            onClick={handleSaveIP}
                            className="bg-[#005B97] text-white px-4 py-1 rounded-lg text-sm md:text-base"
                          >
                            Save IPs
                          </button>
                        </div>
                      )}
                    </li>

                    <li className="p-2 hover:bg-gray-200 cursor-pointer border-b">
                      <Link
                        href="/db-connection"
                        className="flex justify-between items-center"
                      >
                        <span>DB Connection</span>
                        <div className="relative">
                          <FaHouseSignal className="text-[#005B97] text-2xl" />
                          <span
                            className={`absolute top-0 right-0 h-[10px] w-[10px] rounded-full ${getDotColor()}`}
                          />
                        </div>
                      </Link>
                    </li>

                    <li className="p-2 hover:bg-gray-200 cursor-pointer border-b">
                      <Link
                        href="/jobs"
                        className="flex justify-between items-center"
                      >
                        <span>Batch Frequency</span>
                        <TbCloudDataConnection className="text-[#005B97] text-2xl" />
                      </Link>
                    </li>

                    <li className="pl-2 font-semibold pt-2">
                      WMS API Configuration
                    </li>

                    <li className="px-2 border-b pb-3">
                      <span className="block mt-2 mb-1">Hostname</span>
                      <input
                        type="text"
                        placeholder="Hostname..."
                        value={hostName}
                        onChange={(e) => setHostName(e.target.value)}
                        onFocus={() => setIsInputActive(true)}
                        onBlur={() => setIsInputActive(false)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                      <span className="block mt-2 mb-1">Port</span>
                      <input
                        type="text"
                        placeholder="Port..."
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        onFocus={() => setIsInputActive(true)}
                        onBlur={() => setIsInputActive(false)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />
                      <span className="block mt-2 mb-1">Service Name</span>
                      <input
                        type="text"
                        placeholder="Service name..."
                        value={serviceName}
                        onChange={(e) => setServiceName(e.target.value)}
                        onFocus={() => setIsInputActive(true)}
                        onBlur={() => setIsInputActive(false)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />

                      <span className="block mt-2 mb-1">Username</span>
                      <input
                        type="text"
                        placeholder="Username..."
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onFocus={() => setIsInputActive(true)}
                        onBlur={() => setIsInputActive(false)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />

                      <span className="block mt-2 mb-1">Password</span>
                      <input
                        type="password"
                        placeholder="Password..."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setIsInputActive(true)}
                        onBlur={() => setIsInputActive(false)}
                        className="w-full p-2 border border-gray-300 rounded"
                      />

                      {!saved &&
                        (isInputActive ||
                          // wmsUrl !== originalUrl ||
                          username !== originalUsername ||
                          password !== originalPassword ||
                          hostName !== originalHostName ||
                          port !== originalPort ||
                          serviceName !== originalServiceName) && (
                          <button
                            onClick={handleSave}
                            className="mt-2 px-5 py-1 text-base bg-[#005B97] text-white rounded hover:bg-[#3794d2]"
                            disabled={isSaving}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </button>
                        )}

                      {saved && (
                        <p className="text-[#005B97] mt-2">
                          WMS details saved successfully!
                        </p>
                      )}
                    </li>
                    <li className="p-2 border-b">
                      <div className="flex justify-between items-center">
                        <span>Auto Confirmation</span>
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            id="auto-confirmation-toggle"
                            checked={isAutoConfirmationOpen}
                            onChange={toggleAutoConfirmation}
                          />
                          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#005B97]"></div>
                        </label>
                      </div>
                    </li>
                    <li className="p-2 hover:bg-gray-200 cursor-pointer">
                      <p
                        onClick={handleLogout}
                        className="flex justify-between items-center"
                      >
                        <span className="text-gray-800 font-medium">
                          Logout
                        </span>
                        <IoLogOut className="text-[#005B97] text-2xl" />
                      </p>
                    </li>
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="flex items-center gap-3 px-1">
            <Image
              src="/images/user.svg"
              alt="User"
              width={50}
              height={50}
              className="rounded-full"
              onClick={toggleDropdown}
            />
            {isExpanded && (
              <div className="flex justify-between items-center gap-10">
                <div className="flex flex-col">
                  <h1 className="text-lg font-semibold text-gray-800">
                    {userRole === "admin" ? "Admin" : userName}
                  </h1>
                  <p className="text-gray-400">
                    {userRole === "admin"
                      ? ""
                      : userRole === "reviewer"
                      ? "Reviewer"
                      : "User"}
                  </p>
                </div>
                {userRole !== "admin" && (
                  <div>
                    <IoIosArrowForward
                      className="text-lg text-gray-600 transition-transform duration-300 ease-in-out cursor-pointer"
                      onClick={toggleDropdown}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={toggleExpand}
        className={`fixed top-16 ${
          isExpanded ? "translate-x-60" : "translate-x-20"
        } z-30 text-white px-[2px] rounded-full transition-all duration-300 ease-in-out flex items-center justify-center`}
      >
        <span
          className={`transition-all duration-300 ease-in-out ${
            isExpanded ? "rotate-180" : "rotate-0"
          }`}
        >
          <IoIosArrowDroprightCircle fill="#979EAF" size={29} />
        </span>
      </button>
    </>
  );
}
