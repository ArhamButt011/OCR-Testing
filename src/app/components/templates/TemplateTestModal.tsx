// src/app/admin/components/templates/TemplateTestModal.tsx
"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Template } from "./TemplateTable";
import { PDFViewer } from "./PDFViewer";
import { TestResults } from "./TestResults";
import { FileUpload } from "./Fileupload";

interface TemplateTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: Template | null;
}

export const TemplateTestModal: React.FC<TemplateTestModalProps> = ({
  isOpen,
  onClose,
  template,
}) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen || !template) return null;
  if (typeof document === "undefined") return null;

  const handleFileUpload = (file: File) => {
    setUploadedFile(file);
    setTestResults(null);
  };

  const handleTest = async () => {
    if (!uploadedFile) return;

    setIsLoading(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // ✅ DUMMY DATA - Replace this with actual API call later
    const dummyResponse = {
      success: true,
      test_results: {
        template_id: template.template_id,
        template_name: template.template_name,

        classification: {
          predicted_category: "Stamp",
          confidence: 0.89,
          primary_model: {
            prediction: "Stamp",
            confidence: 0.89,
          },
          secondary_model: {
            prediction: "Receipt",
            confidence: 0.12,
          },
        },

        regions_detected: [
          {
            region_name: "stamp",
            detection_method: "yolo",
            confidence: 0.88,
            bounding_box_original: {
              x1: 0.515,
              y1: 0.337,
              x2: 0.994,
              y2: 0.582,
              x1_pixel: 1116,
              y1_pixel: 1013,
              x2_pixel: 2153,
              y2_pixel: 1749,
            },
          },
          {
            region_name: "bill_of_lading_header",
            detection_method: "coordinates",
            confidence: 0.95,
            bounding_box_original: {
              x1: 0.567,
              y1: 0.056,
              x2: 0.996,
              y2: 0.149,
              x1_pixel: 1230,
              y1_pixel: 169,
              x2_pixel: 2158,
              y2_pixel: 448,
            },
          },
          {
            region_name: "customer_order_info",
            detection_method: "coordinates",
            confidence: 0.92,
            bounding_box_original: {
              x1: 0.012,
              y1: 0.584,
              x2: 0.990,
              y2: 0.702,
              x1_pixel: 25,
              y1_pixel: 1754,
              x2_pixel: 2144,
              y2_pixel: 2107,
            },
          },
          {
            region_name: "signatures",
            detection_method: "hybrid",
            confidence: 0.85,
            bounding_box_original: {
              x1: 0.015,
              y1: 0.956,
              x2: 0.999,
              y2: 1.0,
              x1_pixel: 33,
              y1_pixel: 2871,
              x2_pixel: 2166,
              y2_pixel: 3004,
            },
          },
        ],

        extracted_fields: {
          B_L_Number: {
            value: "17537106",
            confidence: 0.98,
            source_region: "bill_of_lading_header",
          },
          POD_Date: {
            value: "2024-10-24",
            confidence: 0.92,
            source_region: "stamp",
          },
          Short_Qty: {
            value: 0,
            confidence: 0.90,
            source_region: "stamp",
          },
          Over_Qty: {
            value: 1,
            confidence: 0.90,
            source_region: "stamp",
          },
          Cartons: {
            value: 145,
            confidence: 0.88,
            source_region: "stamp",
          },
          Pallets: {
            value: 11,
            confidence: 0.85,
            source_region: "stamp",
          },
          Damage_Qty: {
            value: 0,
            confidence: 0.87,
            source_region: "stamp",
          },
          Print_Name: {
            value: "Bryan",
            confidence: 0.82,
            source_region: "stamp",
          },
          Grand_Total_Qty: {
            value: 146,
            confidence: 0.95,
            source_region: "customer_order_info",
          },
          // Total_Weight_LB: {
          //   value: 7294.891,
          //   confidence: 0.94,
          //   source_region: "customer_order_info",
          // },
          // Shipper_Signature_Date: {
          //   value: "2024-10-17",
          //   confidence: 0.85,
          //   source_region: "signatures",
          // },
          // Receiver_Signature: {
          //   value: "EVER SAAVEDA",
          //   confidence: 0.80,
          //   source_region: "signatures",
          // },
          // Receiver_Signature_Date: {
          //   value: "2024-10-24",
          //   confidence: 0.83,
          //   source_region: "signatures",
          // },
          // Carrier_Signature_Date: {
          //   value: "2024-10-17",
          //   confidence: 0.84,
          //   source_region: "signatures",
          // },
          // Ship_From: {
          //   value: "SAMSUNG ELECTRONICS AMERICA",
          //   confidence: 0.96,
          //   source_region: "bill_of_lading_header",
          // },
          // Ship_To: {
          //   value: "INGRAM MICRO (BR70 - MOORE)",
          //   confidence: 0.94,
          //   source_region: "bill_of_lading_header",
          // },
          // Carrier: {
          //   value: "XPO Logistics",
          //   confidence: 0.93,
          //   source_region: "bill_of_lading_header",
          // },
          // Trailer_Number: {
          //   value: "8198",
          //   confidence: 0.91,
          //   source_region: "bill_of_lading_header",
          // },
          // Seal_Number: {
          //   value: "19A9468/2343551",
          //   confidence: 0.89,
          //   source_region: "bill_of_lading_header",
          // },
          // Pro_Number: {
          //   value: "17537106",
          //   confidence: 0.95,
          //   source_region: "bill_of_lading_header",
          // },
          // SCAC: {
          //   value: "XPOL",
          //   confidence: 0.92,
          //   source_region: "bill_of_lading_header",
          // },
        },

        processing_time: {
          classification_ms: 165,
          region_detection_ms: 485,
          ocr_extraction_ms: 2240,
          total_ms: 2890,
        },

        image_metadata: {
          width: 2168,
          height: 3004,
          format: "PDF",
          size_bytes: 487563,
          num_pages: 1,
          processed_page: 1,
        },

        status: "success",
      },
    };

    setTestResults(dummyResponse.test_results);
    setIsLoading(false);
  };

  const handleClose = () => {
    setUploadedFile(null);
    setTestResults(null);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-[95vw] h-[90vh] rounded-2xl shadow-lg relative flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Test Template</h2>
            <p className="text-sm text-gray-600 mt-1">
              {template.template_name} ({template.template_id})
            </p>
          </div>

          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-500 focus:outline-none transition-colors"
            aria-label="Close modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {!uploadedFile && (
            <FileUpload onFileUpload={handleFileUpload} />
          )}

          {uploadedFile && !testResults && (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center">
                <p className="text-lg font-medium text-gray-900 mb-4">
                  File uploaded: {uploadedFile.name}
                </p>
                <button
                  onClick={handleTest}
                  disabled={isLoading}
                  className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Testing...
                    </>
                  ) : (
                    "Run Test"
                  )}
                </button>
              </div>
            </div>
          )}

          {testResults && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              {/* PDF Viewer with Bounding Boxes */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <PDFViewer file={uploadedFile!} regions={testResults.regions_detected} />
              </div>

              {/* Test Results */}
              <div className="overflow-y-auto">
                <TestResults results={testResults} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {testResults && (
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              onClick={() => {
                setUploadedFile(null);
                setTestResults(null);
              }}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Test Another Document
            </button>

            <button
              onClick={handleClose}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};