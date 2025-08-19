"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { usePathname } from "next/navigation"; // 👈 to track route changes

interface DBConnectionContextType {
  db: string | null;
  setDB: (db: string) => void;
}

const DBConnectionContext = createContext<DBConnectionContextType>({
  db: null,
  setDB: () => {},
});

export const DBConnectionProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [db, setDB] = useState<string | null>(null);
  const pathname = usePathname(); // 👈 get current route

  useEffect(() => {
    const fetchDBConnectionType = async () => {
      try {
        const response = await axios.get("/api/oracle/connection-status");
        console.log('db type-> ', response.data.dataBase)
        if (response.data.dataBase) {
          setDB(response.data.dataBase);
        }
      } catch (error) {
        console.error("Error fetching DB connection type:", error);
      }
    };

    fetchDBConnectionType();
  }, [pathname]);

  return (
    <DBConnectionContext.Provider value={{ db, setDB }}>
      {children}
    </DBConnectionContext.Provider>
  );
};

export const useDBConnection = () => useContext(DBConnectionContext);
