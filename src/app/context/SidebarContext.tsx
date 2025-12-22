"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface SidebarContextProps {
  isExpanded: boolean;
  isManual: boolean;
  toggleSidebar: (value?: boolean) => void;
  setManual: (value: boolean) => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isManual, setIsManual] = useState(false);

  // Restore state
  useEffect(() => {
    const savedExpanded = sessionStorage.getItem("sidebar-expanded");
    const savedManual = sessionStorage.getItem("sidebar-manual");

    if (savedExpanded !== null) {
      setIsExpanded(JSON.parse(savedExpanded));
    }
    if (savedManual !== null) {
      setIsManual(JSON.parse(savedManual));
    }
  }, []);

  const toggleSidebar = (value?: boolean) => {
    const newState =
      typeof value === "boolean" ? value : !isExpanded;

    setIsExpanded(newState);
    sessionStorage.setItem("sidebar-expanded", JSON.stringify(newState));
  };

  const setManual = (value: boolean) => {
    setIsManual(value);
    sessionStorage.setItem("sidebar-manual", JSON.stringify(value));
  };

  return (
    <SidebarContext.Provider
      value={{ isExpanded, isManual, toggleSidebar, setManual }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
};
