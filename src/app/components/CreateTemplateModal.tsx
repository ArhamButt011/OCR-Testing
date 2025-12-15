// src/app/templates/CreateTemplateModal.tsx
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { TemplateProvider } from "@/app/context/TemplateContext";
import { Step1BasicInfo } from "./template-steps/Step1BasicInfo";
import { Step2ReferenceImages } from "./template-steps/Step2ReferenceImages";
import { Step3Identification } from "./template-steps/Step3Identification";
import { Step4RegionConfig } from "./template-steps/Step4RegionConfig";
import { Step5Prompts } from "./template-steps/Step5Prompts";
import { Step6FieldMapping } from "./template-steps/Step6FieldMapping";
import { Step7Review } from "./template-steps/Step7Review";
import { useTemplate } from "@/app/context/TemplateContext";

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId?: string;
  templateId?: string; 
}
const ModalPortal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  buttonContent?: React.ReactNode;
  isBilling?: boolean;
}> = ({ isOpen, onClose, children, buttonContent, isBilling }) => {
  if (!isOpen) return null;

  // Guard for SSR safety
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4">
      <div
        className={`bg-white w-full ${
          !isBilling ? "md:max-w-6xl max-w-[350px]" : "max-w-[1400px]"
        } rounded-2xl md:px-6 py-2 shadow-lg relative max-h-[90vh] overflow-y-auto`}
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          aria-label="Close modal"
          className="absolute top-4 right-4 text-primary underline cursor-pointer font-semibold"
          onClick={onClose}
        >
          {buttonContent ?? "Close"}
        </button>

        <div>{children}</div>
      </div>
    </div>,
    document.body
  );
};

function ModalContentInner({ onClose, isEditMode }: { onClose: () => void; isEditMode: boolean }) {
  const {
    currentStep,
    setCurrentStep,
    totalSteps,
    validateStep,
    saveDraft,
    isSaving,
    originalDraftId,
    lastSaved
  } = useTemplate();

  const steps = [
    { number: 1, name: "Basic Info", component: Step1BasicInfo },
    { number: 2, name: "Images", component: Step2ReferenceImages },
    { number: 3, name: "Identification", component: Step3Identification },
    { number: 4, name: "Regions", component: Step4RegionConfig },
    { number: 5, name: "Prompts", component: Step5Prompts },
    { number: 6, name: "Mapping", component: Step6FieldMapping },
    { number: 7, name: "Review", component: Step7Review },
  ];

  const CurrentStepComponent = steps[currentStep - 1].component;

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, totalSteps));
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (!isEditMode && confirm("Are you sure you want to close? Your progress has been auto-saved.")) {
      onClose();
    }
    else{
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[60vh]">
      {/* Modal Header - UPDATED with dynamic title */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex-1 pr-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditMode ? "Edit OCR Template" : "Create OCR Template"}
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Step {currentStep} of {totalSteps}: {steps[currentStep - 1].name}
          </p>
        </div>

        {/* Auto-save Indicator */}
        <div className="flex items-center gap-4 mr-4">
          {isSaving ? (
            <span className="flex items-center text-sm text-gray-600">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : lastSaved ? (
            <span className="text-sm text-gray-600">Saved {lastSaved.toLocaleTimeString()}</span>
          ) : null}
        </div>

        {/* Close Button */}
        <button onClick={handleClose} className="text-gray-400 hover:text-gray-500 focus:outline-none">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.number}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    currentStep === step.number
                      ? "border-primary bg-primary text-white"
                      : currentStep > step.number
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-300 bg-white text-gray-500"
                  }`}
                >
                  {currentStep > step.number ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span className="mt-1 text-xs font-medium text-gray-600 hidden sm:block">{step.name}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-1 transition-colors ${currentStep > step.number ? "bg-green-600" : "bg-gray-300"}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Modal Body - Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <CurrentStepComponent />
      </div>

      {/* Modal Footer - Navigation */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-3">
         {!isEditMode&& <button
            onClick={() => saveDraft()}
            className="inline-flex items-center px-4 py-2 border border-primary rounded-md text-sm font-medium text-primary bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Draft
          </button>}

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Next
              <svg className="h-4 w-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* --------------------------
   Exported CreateTemplateModal that uses Portal + TemplateProvider
   -------------------------- */
export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({ 
  isOpen, 
  onClose, 
  draftId,
  templateId // NEW
}) => {
  return (
    <ModalPortal isOpen={isOpen} onClose={onClose} buttonContent="Close" isBilling={true}>
      <TemplateProvider 
        initialDraftId={draftId}
        initialTemplateId={templateId} // NEW: Pass templateId for edit mode
      >
        <ModalContentInner onClose={onClose} isEditMode={!!templateId} />
      </TemplateProvider>
    </ModalPortal>
  );
};

export default CreateTemplateModal;