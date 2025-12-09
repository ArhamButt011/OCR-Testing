"use client";

import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { TemplateProvider, useTemplate } from '@/app/context/TemplateContext';
import { Step1BasicInfo } from './template-steps/Step1BasicInfo';
import { Step2ReferenceImages } from './template-steps/Step2ReferenceImages';
import { Step3Identification } from './template-steps/Step3Identification';
import { Step4RegionConfig } from './template-steps/Step4RegionConfig';
import { Step5Prompts } from './template-steps/Step5Prompts';
import { Step6FieldMapping } from './template-steps/Step6FieldMapping';
import { Step7Review } from './template-steps/Step7Review';

interface CreateTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId?: string;
}

function ModalContent({ onClose }: { onClose: () => void }) {
  const {
    currentStep,
    setCurrentStep,
    totalSteps,
    validateStep,
    saveDraft,
    isSaving,
    lastSaved,
    templateData,
  } = useTemplate();

  const steps = [
    { number: 1, name: 'Basic Info', component: Step1BasicInfo },
    { number: 2, name: 'Images', component: Step2ReferenceImages },
    { number: 3, name: 'Identification', component: Step3Identification },
    { number: 4, name: 'Regions', component: Step4RegionConfig },
    { number: 5, name: 'Prompts', component: Step5Prompts },
    { number: 6, name: 'Mapping', component: Step6FieldMapping },
    { number: 7, name: 'Review', component: Step7Review },
  ];

  const CurrentStepComponent = steps[currentStep - 1].component;

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (confirm('Are you sure you want to close? Your progress has been auto-saved.')) {
      onClose();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Modal Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-900">
            Create OCR Template
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Step {currentStep} of {totalSteps}: {steps[currentStep - 1].name}
          </p>
        </div>
        
        {/* Auto-save Indicator */}
        <div className="flex items-center gap-4 mr-4">
          {isSaving ? (
            <span className="flex items-center text-sm text-gray-600">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Saving...
            </span>
          ) : lastSaved ? (
            <span className="text-sm text-gray-600">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          ) : null}
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className="text-gray-400 hover:text-gray-500 focus:outline-none"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                      ? 'border-primary bg-primary text-white'
                      : currentStep > step.number
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {currentStep > step.number ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <span className="mt-1 text-xs font-medium text-gray-600 hidden sm:block">
                  {step.name}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-1 mx-1 transition-colors ${
                  currentStep > step.number ? 'bg-green-600' : 'bg-gray-300'
                }`} />
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
          <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => saveDraft()}
            className="inline-flex items-center px-4 py-2 border border-primary rounded-md text-sm font-medium text-primary bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            Save Draft
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={handleNext}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            >
              Next
              <svg className="h-4 w-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const CreateTemplateModal: React.FC<CreateTemplateModalProps> = ({
  isOpen,
  onClose,
  draftId,
}) => {
  return (
    <Transition appear show={isOpen} as={Fragment}>
<Dialog as={Fragment} onClose={() => {}}>
    <div className="relative z-50">

        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" />
        </Transition.Child>

        {/* Modal */}
        <div className="fixed inset-0 overflow-hidden">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-6xl h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col">
                <TemplateProvider initialDraftId={draftId}>
                  <ModalContent onClose={onClose} />
                </TemplateProvider>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
        </div>
      </Dialog>
    </Transition>
  );
};