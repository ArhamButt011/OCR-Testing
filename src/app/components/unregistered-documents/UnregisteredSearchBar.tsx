// src/app/admin/components/unregistered/UnregisteredSearchBar.tsx
"use client";

import React from "react";
import { FiSearch } from "react-icons/fi";
import { FaChevronDown } from "react-icons/fa";

interface UnregisteredSearchBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  sortBy: string;
  onSortByChange: (value: string) => void;
  sortOrder: "asc" | "desc";
  onSortOrderChange: (value: "asc" | "desc") => void;
  onSearch: () => void;
}

export const UnregisteredSearchBar: React.FC<UnregisteredSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  categoryFilter,
  onCategoryChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onSearch
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Documents
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="BL Number, File ID..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full px-4 py-2 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-3 flex items-center text-gray-500"
              >
                <FiSearch size={20} className="text-primary" />
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="w-full px-4 py-2 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="">All Categories</option>
                <option value="Stamp">Stamp</option>
                <option value="Notation">Notation</option>
                <option value="Receipt">Receipt</option>
              </select>
              <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary pointer-events-none" size={16} />
            </div>
          </div>

          {/* Sort By */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => onSortByChange(e.target.value)}
                className="w-full px-4 py-2 pr-10 border rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="createdAt">Date Added</option>
                <option value="confidence">Confidence Score</option>
                <option value="blNumber">BL Number</option>
              </select>
              <FaChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary pointer-events-none" size={16} />
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          {/* Sort Order */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Order:</label>
            <button
              type="button"
              onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition"
            >
              {sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
            </button>
          </div>

          {/* Apply Button */}
          <button
            type="submit"
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary-dark transition"
          >
            Apply Filters
          </button>
        </div>
      </form>
    </div>
  );
};