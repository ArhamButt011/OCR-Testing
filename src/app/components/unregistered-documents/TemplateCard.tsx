// src/app/components/unregistered-documents/TemplateCard.tsx
"use client";

import React from "react";
import Image from "next/image";

interface SuggestedTemplate {
  template_id: string;
  template_name: string;
  match_score: number;
  priority: number;
  category: string;
  thumbnail_url: string;
  version: string;
}

interface TemplateCardProps {
  template: SuggestedTemplate;
  isSelected: boolean;
  onSelect: (templateId: string) => void;
  onViewDetails: (templateId: string) => void;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({
  template,
  isSelected,
  onSelect,
  onViewDetails,
}) => {
  const getMatchScoreColor = (score: number) => {
    if (score >= 0.7) return "bg-green-500";
    if (score >= 0.5) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div
      onClick={() => onSelect(template.template_id)}
      className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-primary bg-blue-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm">
          {template.priority}
        </div>

        <div className="flex-shrink-0 w-20 h-28 bg-gray-100 rounded overflow-hidden relative">
          {template.thumbnail_url ? (
            <Image
              src={template.thumbnail_url}
              alt={template.template_name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <span className="text-gray-400 text-2xl">📄</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-2">
            {template.template_name}
          </h4>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              {template.category}
            </span>
            <span className="text-xs text-gray-500">v{template.version}</span>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Match Score</span>
              <span className="text-sm font-semibold text-gray-900">
                {(template.match_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${getMatchScoreColor(
                  template.match_score
                )}`}
                style={{
                  width: `${template.match_score * 100}%`,
                }}
              />
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(template.template_id);
            }}
            className="text-xs text-primary hover:text-primary-dark font-medium"
          >
            View Details
          </button>
        </div>

        {isSelected && (
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-primary"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};