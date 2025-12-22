// src/app/admin/components/templates/TemplateTable.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BiSolidEditAlt } from "react-icons/bi";
import { MdDelete } from "react-icons/md";
import { AiOutlineEye } from "react-icons/ai";
import { FaFlask } from "react-icons/fa";

export interface Template {
  _id: string;
  template_id: string;
  template_name: string;
  category: string;
  status: "active" | "inactive" | "deprecated";
  version: string;
  metadata: {
    created_at: string;
    updated_at: string;
    usage_count?: number;
    success_rate?: number;
  };
}

export type SortField =
  | "template_id"
  | "template_name"
  | "category"
  | "status"
  | "documents_processed"
  | "accuracy_rate";
export type SortDirection = "asc" | "desc";

interface TemplateTableProps {
  templates: Template[];
  sortField: string;
  sortDirection: SortDirection;
  onSort: (field: string) => void;
  onActivate: (templateId: string) => void;
  onDeactivate: (templateId: string) => void;
  onDeprecate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onEdit: (templateId: string) => void;
  onTest: (template: Template) => void;
}

export const TemplateTable: React.FC<TemplateTableProps> = ({
  templates,
  sortField,
  sortDirection,
  onSort,
  onActivate,
  onDeactivate,
  onDeprecate,
  onDelete,
  onEdit,
  onTest,
}) => {
  const router = useRouter();

  const getStatusBadge = (status: string) => {
    const styles = {
      active: "bg-green-100 text-green-800",
      inactive: "bg-gray-100 text-gray-800",
      deprecated: "bg-red-100 text-red-800",
    };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          (styles as any)[status]
        }`}
      >
        {status}
      </span>
    );
  };

  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return (
        <svg
          className="w-4 h-4 ml-1 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }

    return sortDirection === "asc" ? (
      <svg
        className="w-4 h-4 ml-1 text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 15l7-7 7 7"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4 ml-1 text-primary"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    );
  };

  const handleViewDetails = (templateId: string) => {
    router.push(`/templates/${templateId}`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="w-full overflow-x-auto grid grid-cols-1">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Template ID - Sortable */}
              <th
                onClick={() => onSort("template_id")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Template ID
                  {renderSortIcon("template_id")}
                </div>
              </th>

              {/* Name - Sortable */}
              <th
                onClick={() => onSort("template_name")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Name
                  {renderSortIcon("template_name")}
                </div>
              </th>

              {/* Category - Sortable */}
              <th
                onClick={() => onSort("category")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Category
                  {renderSortIcon("category")}
                </div>
              </th>

              {/* Status - Sortable */}
              <th
                onClick={() => onSort("status")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Status
                  {renderSortIcon("status")}
                </div>
              </th>

              {/* Documents Processed - Sortable */}
              <th
                onClick={() => onSort("metadata.usage_count")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Documents Processed
                  {renderSortIcon("metadata.usage_count")}
                </div>
              </th>

              {/* Accuracy Rate - Sortable */}
              <th
                onClick={() => onSort("metadata.success_rate")}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center">
                  Accuracy Rate
                  {renderSortIcon("metadata.success_rate")}
                </div>
              </th>

              {/* Actions - Not sortable */}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {templates.map((template) => (
              <tr key={template._id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                  {template.template_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {template.template_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {template.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(template.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {template.metadata.usage_count?.toLocaleString() || "0"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {template.metadata.success_rate !== undefined
                    ? `${(template.metadata.success_rate * 100).toFixed(1)}%`
                    : "N/A"}
                </td>
                 <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {template.metadata.success_rate !== undefined
                    ? `${(template.metadata.success_rate * 100).toFixed(1)}%`
                    : "N/A"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-3 items-center">
                    <button
                      onClick={() => onTest(template)}
                      className="text-purple-600 hover:text-purple-900"
                      title="Test template"
                    >
                      <FaFlask className="text-xl" />
                    </button>

                    {/* Details Button - Always visible */}
                    <button
                      onClick={() => handleViewDetails(template._id)}
                      className="text-primary hover:text-primary-dark"
                      title="View template details"
                    >
                      <AiOutlineEye className="text-2xl" />
                    </button>

                    {/* Edit Button - Always visible */}
                    <button
                      onClick={() => onEdit(template._id)}
                      className="text-blue-600 hover:text-blue-900 font-medium"
                      title="Edit template"
                    >
                      <BiSolidEditAlt className="fill-[#005B97] text-2xl" />
                    </button>

                    {/* Inactive templates: Show Activate */}
                    {template.status === "inactive" && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => onActivate(template._id)}
                          className="text-green-600 hover:text-green-900 font-medium text-sm"
                          title="Activate template"
                        >
                          Activate
                        </button>
                        <button
                          onClick={() => onDeprecate(template._id)}
                          className="text-red-600 hover:text-red-900 font-medium text-sm"
                          title="Deprecate template (cannot be reactivated)"
                        >
                          Deprecate
                        </button>
                      </div>
                    )}

                    {/* Active templates: Show Deactivate */}
                    {template.status === "active" && (
                      <button
                        onClick={() => onDeactivate(template._id)}
                        className="text-orange-600 hover:text-orange-900 font-medium text-sm"
                        title="Deactivate template"
                      >
                        Deactivate
                      </button>
                    )}

                    {/* Delete button for all templates */}
                    <button onClick={() => onDelete(template._id)} title="Delete template">
                      <MdDelete className="fill-[red] text-2xl" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};