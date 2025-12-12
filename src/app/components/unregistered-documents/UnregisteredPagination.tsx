// src/app/admin/components/unregistered/UnregisteredPagination.tsx
"use client";

import React from "react";

interface UnregisteredPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const UnregisteredPagination: React.FC<UnregisteredPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange
}) => {
  return (
    <div className="mt-6 flex justify-end items-center gap-5">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-6 py-2 rounded-md font-medium transition ${
          currentPage === 1
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-primary text-white hover:bg-primary-dark"
        }`}
      >
        Previous
      </button>
      
      <span className="text-gray-700 font-medium">
        Page {currentPage} of {totalPages}
      </span>
      
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`px-6 py-2 rounded-md font-medium transition ${
          currentPage === totalPages
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-primary text-white hover:bg-primary-dark"
        }`}
      >
        Next
      </button>
    </div>
  );
};