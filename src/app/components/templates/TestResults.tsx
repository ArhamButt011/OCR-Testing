// src/app/admin/components/templates/TestResults.tsx
"use client";

import React from "react";

interface TestResultsProps {
  results: any;
}

export const TestResults: React.FC<TestResultsProps> = ({ results }) => {
  // Helper function to safely get extracted data fields
  const getExtractedDataEntries = () => {
    if (!results?.extracted_data) return [];
    
    // Filter out metadata fields that aren't actual extracted fields
    const excludeFields = ['template_id', 'confidence', 'processing_time', 'classification_details', 'suggested_templates'];
    
    return Object.entries(results.extracted_data).filter(
      ([key]) => !excludeFields.includes(key)
    );
  };

  const extractedEntries = getExtractedDataEntries();

  return (
    <div className="space-y-6">
      {/* Classification Results */}
      {results?.extracted_data?.classification_details && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Classification Results</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Template ID:</span>
              <span className="text-sm font-semibold text-gray-900">
                {results.extracted_data.template_id || 'N/A'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Overall Confidence:</span>
              <span className="text-sm font-semibold text-green-600">
                {((results.extracted_data.confidence || 0) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1">Primary Model</p>
                  <p className="text-sm text-gray-900">
                    {results.extracted_data.classification_details.primary_model_prediction || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {((results.extracted_data.classification_details.primary_confidence || 0) * 100).toFixed(1)}%
                  </p>
                </div>

                {results.extracted_data.classification_details.secondary_model_prediction && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Secondary Model</p>
                    <p className="text-sm text-gray-900">
                      {results.extracted_data.classification_details.secondary_model_prediction}
                    </p>
                    <p className="text-xs text-gray-500">
                      {((results.extracted_data.classification_details.secondary_confidence || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Processing Time */}
      {results?.processing_time && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Processing Time</h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">Total Processing Time:</span>
              <span className="text-sm font-bold text-primary">
                {results.processing_time}ms ({(results.processing_time / 1000).toFixed(2)}s)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Extracted Fields */}
      {extractedEntries.length > 0 && (
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
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {extractedEntries.map(([fieldName, fieldValue]: [string, any]) => (
                  <tr key={fieldName} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {fieldName.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      <span className="font-mono">
                        {typeof fieldValue === "number"
                          ? fieldValue.toLocaleString()
                          : fieldValue?.toString() || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detected Regions Summary */}
      {results?.regions_metadata && results.regions_metadata.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Detected Regions</h3>
          
          <div className="space-y-2">
            {results.regions_metadata.map((region: any, index: number) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {region?.region_name?.replace(/_/g, " ") || 'Unknown Region'}
                  </p>
                  <p className="text-xs text-gray-600">
                    Position: x1={region?.bbox?.x1}, y1={region?.bbox?.y1}, x2={region?.bbox?.x2}, y2={region?.bbox?.y2}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    (region?.confidence || 0) >= 0.9
                      ? "bg-green-100 text-green-800"
                      : (region?.confidence || 0) >= 0.8
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {((region?.confidence || 0) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Templates */}
      {results?.extracted_data?.suggested_templates && results.extracted_data.suggested_templates.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Suggested Templates</h3>
          
          <div className="space-y-2">
            {results.extracted_data.suggested_templates.map((template: string, index: number) => (
              <div key={index} className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-blue-900 font-medium">{template}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success Message */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-green-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-green-900">Template Test Successful</h4>
            <p className="text-sm text-green-700 mt-1">
              The document was successfully processed and data was extracted using template "{results?.extracted_data?.template_id || 'Unknown'}".
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};