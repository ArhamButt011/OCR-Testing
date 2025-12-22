// src/app/admin/components/templates/TestResults.tsx
"use client";

import React from "react";

interface TestResultsProps {
  results: any;
}

export const TestResults: React.FC<TestResultsProps> = ({ results }) => {
  return (
    <div className="space-y-6">
      {/* Classification Results */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Classification Results</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Predicted Category:</span>
            <span className="text-sm font-semibold text-gray-900">
              {results?.classification?.predicted_category}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Confidence:</span>
            <span className="text-sm font-semibold text-green-600">
              {(results?.classification?.confidence * 100).toFixed(1)}%
            </span>
          </div>

          <div className="pt-3 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Primary Model</p>
                <p className="text-sm text-gray-900">
                  {results?.classification?.primary_model.prediction}
                </p>
                <p className="text-xs text-gray-500">
                  {(results?.classification?.primary_model.confidence * 100).toFixed(1)}%
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-600 mb-1">Secondary Model</p>
                <p className="text-sm text-gray-900">
                  {results?.classification?.secondary_model?.prediction}
                </p>
                <p className="text-xs text-gray-500">
                  {(results?.classification?.secondary_model?.confidence * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Processing Time */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing Time</h3>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Classification:</span>
            <span className="text-sm font-medium text-gray-900">
              {results?.processing_time?.classification_ms}ms
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Region Detection:</span>
            <span className="text-sm font-medium text-gray-900">
              {results?.processing_time?.region_detection_ms}ms
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">OCR Extraction:</span>
            <span className="text-sm font-medium text-gray-900">
              {results?.processing_time?.ocr_extraction_ms}ms
            </span>
          </div>

          <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">Total:</span>
            <span className="text-sm font-bold text-primary">
              {results?.processing_time?.total_ms}ms
            </span>
          </div>
        </div>
      </div>

      {/* Extracted Fields */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Extracted Fields</h3>
        
        <div className="max-h-[400px] overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                  Field
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                  Value
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                  Confidence
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                  Source
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(results?.extracted_fields).map(([fieldName, fieldData]: [string, any]) => (
                <tr key={fieldName} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-medium text-gray-900">
                    {fieldName.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">
                    <span className="font-mono">
                      {typeof fieldData.value === "number"
                        ? fieldData.value.toLocaleString()
                        : fieldData.value}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        fieldData.confidence >= 0.9
                          ? "bg-green-100 text-green-800"
                          : fieldData.confidence >= 0.8
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {(fieldData.confidence * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {fieldData.source_region.replace(/_/g, " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detected Regions Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Detected Regions</h3>
        
        <div className="space-y-2">
          {results?.regions_detected.map((region: any, index: number) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {region?.region_name.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-gray-600">
                  Method: <span className="font-medium">{region?.detection_method}</span>
                </p>
              </div>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  region?.confidence >= 0.9
                    ? "bg-green-100 text-green-800"
                    : region?.confidence >= 0.8
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {(region?.confidence * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Image Metadata */}
      {/* <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Document Info</h3>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-gray-600">Format:</p>
            <p className="font-medium text-gray-900">{results.image_metadata.format}</p>
          </div>

          <div>
            <p className="text-gray-600">Dimensions:</p>
            <p className="font-medium text-gray-900">
              {results.image_metadata.width} × {results.image_metadata.height}
            </p>
          </div>

          <div>
            <p className="text-gray-600">Size:</p>
            <p className="font-medium text-gray-900">
              {(results.image_metadata.size_bytes / 1024).toFixed(1)} KB
            </p>
          </div>

          <div>
            <p className="text-gray-600">Pages:</p>
            <p className="font-medium text-gray-900">
              {results.image_metadata.processed_page} / {results.image_metadata.num_pages}
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
};