"use client";
import React from "react";
import { useParams } from "next/navigation";
import Sidebar from "@/app/components/Sidebar";
import Header from "@/app/components/Header";
import { useSidebar } from "@/app/context/SidebarContext";

const LogDetails = () => {
  const params = useParams();
  const { isExpanded } = useSidebar();
  console.log("params id-> ", params.id);
  
    const handleSidebarStateChange = (newState: boolean) => {
    // setIsSidebarExpanded(newState);
    return newState;
  };
  return    <div className="flex flex-row h-screen bg-white">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          !isExpanded ? "ml-24" : "ml-64"
        }`}
      >
        <Header
          leftContent="Total Logs"
          totalContent={10}
          rightContent={
            <input
              type="text"
              placeholder="Search user..."
              className="px-4 py-2 rounded-lg border border-gray-300"
            //   value={searchQuery}
            //   onChange={(e) => setSearchQuery(e.target.value)}
            />
          }
          buttonContent={""}
        />
         <div className="flex-1 p-4 bg-white">
          {/* {loadingTable ? (
            <div className="flex justify-center items-center">
              <Spinner />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center mt-20">
             No logs found..
            </div>
          ) : (
          <div>Logs</div>
          )} */}

          {params?.id}

  
        </div> 

     
      </div>
    </div>
};

export default LogDetails;
