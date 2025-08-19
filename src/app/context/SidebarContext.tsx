"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SidebarContextProps {
    isExpanded: boolean;
    toggleSidebar: () => void;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedState = sessionStorage.getItem("sidebar");
            if (savedState !== null) {
                setIsExpanded(JSON.parse(savedState));
            }
        }
    }, []);

    const toggleSidebar = () => {
        const newState = !isExpanded;
        setIsExpanded(newState);
        if (typeof window !== "undefined") {
            sessionStorage.setItem("sidebar", JSON.stringify(newState));
        }
    };

    return (
        <SidebarContext.Provider value={{ isExpanded, toggleSidebar }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
};
