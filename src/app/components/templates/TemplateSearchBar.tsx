// src/app/admin/components/templates/TemplateSearchBar.tsx
"use client";

import React from 'react';

interface TemplateSearchBarProps {
  searchQuery: string;
  sortBy: string;
  onSearchChange: (query: string) => void;
  filterStatus: string;
  onStatusChange: (status: string) => void;
  filterCategory: string;
  onCategoryChange: (category: string) => void;
  onClearFilters: () => void;
  handleSort: (sortBy: string) => void;
}

export const TemplateSearchBar: React.FC<TemplateSearchBarProps> = ({
  searchQuery,
  onSearchChange,
  filterStatus,
  onStatusChange,
  handleSort,
  sortBy,
  filterCategory,
  onCategoryChange,
  onClearFilters,
}) => {

  const hasActiveFilters = searchQuery || filterStatus !== 'all' || filterCategory !== 'all' || sortBy!=='';

  return (
    <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by template ID or name..."
              className="block w-full rounded-md border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Status Filter - AC-013-2 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="deprecated">Deprecated</option>
          </select>
        </div>

        {/* Category Filter - AC-013-2 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={filterCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-primary"
          >
            <option value="all">All Categories</option>
            <option value="Stamp">Stamp</option>
            <option value="Notation">Notation</option>
            <option value="Receipt">Receipt</option>
          </select>
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active filters:</span>
          
          {searchQuery && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-primary">
              Search: "{searchQuery}"
              <button
                onClick={() => onSearchChange('')}
                className="ml-1 text-primary hover:text-primary"
              >
                ×
              </button>
            </span>
          )}
          
          {filterStatus !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-primary">
              Status: {filterStatus}
              <button
                onClick={() => onStatusChange('all')}
                className="ml-1 text-primary hover:text-primary"
              >
                ×
              </button>
            </span>
          )}
          
          {filterCategory !== 'all' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-primary">
              Category: {filterCategory}
              <button
                onClick={() => onCategoryChange('all')}
                className="ml-1 text-primary hover:text-primary"
              >
                ×
              </button>
            </span>
          )}

          {sortBy !== '' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-primary">
              Sort By: {sortBy}
              <button
                onClick={() => handleSort('')}
                className="ml-1 text-primary hover:text-primary"
              >
                ×
              </button>
            </span>
          )}
          
          <button
            onClick={onClearFilters}
            className="text-xs text-gray-600 hover:text-gray-800 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};