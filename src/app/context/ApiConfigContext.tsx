"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface ApiConfigContextType {
  ocrApiUrl: string;
  baseUrl: string;
  isLoading: boolean;
  error: string | null;
}

const ApiConfigContext = createContext<ApiConfigContextType | undefined>(
  undefined
);

export const ApiConfigProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [ocrApiUrl, setOcrApiUrl] = useState<string>("");
  const [baseUrl, setBaseUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchApiConfig() {
      try {
        setIsLoading(true);
        setError(null);

        const res = await fetch("/api/ipAddress/ip-address", {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json();

        if (data.ip) {
          // For local uncomment below lines
          // setOcrApiUrl(`http://${data.ip}:8080/run-ocr`);
          // setBaseUrl(`http://${data.secondaryIp}:3000`);
          
          // For remote use below lines
          setOcrApiUrl(`https://kkti3idqzhgqny-8080.proxy.runpod.net/run-ocr`);
          setBaseUrl(`https://fzi6t0m8gas6eb-8080.proxy.runpod.net`);
        //   setBaseUrl(`http://localhost:3000`);

        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch API configuration";
        console.error("Failed to fetch API config:", err);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }

    fetchApiConfig();
  }, []);

  return (
    <ApiConfigContext.Provider value={{ ocrApiUrl, baseUrl, isLoading, error }}>
      {children}
    </ApiConfigContext.Provider>
  );
};

// Custom hook to use the API config context
export const useApiConfig = () => {
  const context = useContext(ApiConfigContext);
  if (context === undefined) {
    throw new Error("useApiConfig must be used within an ApiConfigProvider");
  }
  return context;
};