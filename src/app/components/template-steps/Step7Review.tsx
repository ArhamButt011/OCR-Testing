"use client";

import React, { useState } from "react";
import { useTemplate } from "@/app/context/TemplateContext";
import { toast } from "react-toastify";
import { getErrorToastText } from "@/lib/common/getErrorToastText";
import { useApiConfig } from "@/app/context/ApiConfigContext";

export const Step7Review: React.FC = () => {
  const { templateData, submitTemplate, isEditMode, onModalClose } = useTemplate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { baseUrl } = useApiConfig();

const handleSaveInactive = async () => {
  setIsSubmitting(true);

  try {
    const templateRes = await submitTemplate();
    console.log("Template API response:", templateRes);

    // Extract the actual template data - API might return { template: {...} } or just {...}
    const templateInfo = templateRes?.template || templateRes;
    
    console.log("Extracted template info:", templateInfo);
    
    toast.success(
      `${templateRes?.message || (isEditMode ? 'Template updated successfully' : 'Template created successfully')} - ID: ${
        templateInfo?.template_id || templateData.template_id
      }, Version: ${templateInfo?.version || templateData.version}`
    );

    // Pass the template data back to parent to update local state
    // Pass templateInfo directly (not nested in an object)
    setTimeout(() => {
      if (onModalClose) {
        console.log("Calling onModalClose with template data:", templateInfo);
        onModalClose(false, templateInfo); // Pass the actual template object
      }
    }, 1000);
  } catch (err: any) {
    console.error("Save failed:", err);
    toast.error(getErrorToastText(err, "Failed to save template"));
  } finally {
    setIsSubmitting(false);
  }
};

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review & Save</h2>
        <p className="mt-1 text-sm text-gray-600">
          Review your template configuration before saving
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <svg
              className="h-5 w-5 mr-2 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Basic Information
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Template ID:</dt>
              <dd className="font-mono font-medium text-gray-900">
                {templateData.template_id}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Name:</dt>
              <dd className="font-medium text-gray-900">
                {templateData.template_name}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Category:</dt>
              <dd className="font-medium text-gray-900">
                {templateData.category}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-600">Version:</dt>
              <dd className="font-medium text-gray-900">
                {templateData.version}
              </dd>
            </div>
          </dl>
        </div>

        {/* Reference Images */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <svg
              className="h-5 w-5 mr-2 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Reference Images
          </h3>
          <p className="text-sm text-gray-600">
            {templateData.identification?.reference_images?.length || 0}{" "}
            image(s) uploaded
          </p>
          {templateData.identification?.reference_images && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {templateData.identification.reference_images
                .slice(0, 3)
                .map((img, idx) => (
                  <div
                    key={img.image_id}
                    className="aspect-square bg-gray-100 rounded border border-gray-300 relative overflow-hidden"
                  >
                    {img.file_path && (
                      <img
                        src={`${baseUrl}${img.file_path}`}
                        alt={`Ref ${idx + 1}`}
                        className="w-full h-full object-contain"
                      />
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Identification Patterns */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <svg
              className="h-5 w-5 mr-2 text-purple-600"
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
            Text Patterns
          </h3>
          <div className="space-y-2">
            {templateData.identification?.text_patterns?.map((pattern, idx) => (
              <div
                key={idx}
                className="text-xs font-mono bg-gray-50 px-3 py-2 rounded border border-gray-200 break-all"
              >
                {pattern}
              </div>
            ))}
            {!templateData.identification?.text_patterns?.length && (
              <p className="text-sm text-gray-500">No patterns defined</p>
            )}
          </div>
        </div>

        {/* Region Configuration */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <svg
              className="h-5 w-5 mr-2 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            Region Detection
          </h3>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-600">Method:</dt>
              <dd className="font-medium text-gray-900 capitalize">
                {templateData.region_config?.detection_method ||
                  "Not configured"}
              </dd>
            </div>
            {templateData.region_config?.detection_method === "yolo" && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Model:</dt>
                <dd className="font-mono text-xs text-gray-900">
                  {templateData.region_config.yolo_config?.model_path || "N/A"}
                </dd>
              </div>
            )}
            {templateData.region_config?.detection_method === "coordinates" && (
              <div className="flex justify-between">
                <dt className="text-gray-600">Regions:</dt>
                <dd className="font-medium text-gray-900">
                  {templateData.region_config.coordinate_regions?.length || 0}{" "}
                  defined
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Prompts */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <svg
              className="h-5 w-5 mr-2 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            Region Prompts
          </h3>
          <div className="space-y-2">
            {Object.keys(templateData.prompts || {}).map((region) => (
              <div
                key={region}
                className="flex items-center justify-between text-sm"
              >
                <span className="font-medium text-gray-900">{region}</span>
                <span className="text-green-600 flex items-center">
                  <svg
                    className="h-4 w-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Configured
                </span>
              </div>
            ))}
            {!Object.keys(templateData.prompts || {}).length && (
              <p className="text-sm text-gray-500">No prompts configured</p>
            )}
          </div>
        </div>

        {/* Field Mappings */}
        <div className="bg-white border border-gray-300 rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <svg
              className="h-5 w-5 mr-2 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Field Mappings
          </h3>
          <p className="text-sm text-gray-600 mb-3">
            {Object.keys(templateData.field_mapping || {}).length} mapping(s)
            defined
          </p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {Object.entries(templateData.field_mapping || {}).map(
              ([target, mapping]) => (
                <div
                  key={target}
                  className="text-xs font-mono bg-gray-50 px-3 py-2 rounded border border-gray-200"
                >
                  <span className="text-primary">
                    {(mapping as any).source_field}
                  </span>
                  {" -> "}
                  <span className="text-green-600">{target}</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="rounded-lg p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSaveInactive}
            disabled={isSubmitting}
            className="flex-1 inline-flex justify-center items-center px-6 py-3 border border-gray-300 rounded-md shadow-sm text-base font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {!isEditMode ? "Saving..." : "Updating..."}
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {!isEditMode ? "Save as Inactive" : "Update Template"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};