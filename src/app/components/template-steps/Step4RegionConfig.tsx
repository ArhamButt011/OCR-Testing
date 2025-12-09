"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';

export const Step4RegionConfig: React.FC = () => {
  const { templateData, updateTemplateData, errors } = useTemplate();
  const [selectedMethod, setSelectedMethod] = useState<'yolo' | 'coordinates' | 'hybrid'>(
    templateData.region_config?.detection_method || 'hybrid'
  );

  const handleMethodChange = (method: 'yolo' | 'coordinates' | 'hybrid') => {
    setSelectedMethod(method);
    updateTemplateData({
      region_config: {
        ...templateData.region_config,
        detection_method: method
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Region Configuration</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure how regions are detected in documents
        </p>
      </div>

      {/* Detection Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Detection Method *
        </label>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* YOLO Option */}
          <div
            onClick={() => handleMethodChange('yolo')}
            className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
              selectedMethod === 'yolo'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center">
              <input
                type="radio"
                checked={selectedMethod === 'yolo'}
                onChange={() => handleMethodChange('yolo')}
                className="h-4 w-4 text-primary border-gray-300 focus:ring-blue-500"
              />
              <label className="ml-3">
                <span className="block text-sm font-medium text-gray-900">
                  YOLO Detection
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  AI-powered region detection
                </span>
              </label>
            </div>
          </div>

          {/* Coordinates Option */}
          <div
            onClick={() => handleMethodChange('coordinates')}
            className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
              selectedMethod === 'coordinates'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center">
              <input
                type="radio"
                checked={selectedMethod === 'coordinates'}
                onChange={() => handleMethodChange('coordinates')}
                className="h-4 w-4 text-primary border-gray-300 focus:ring-blue-500"
              />
              <label className="ml-3">
                <span className="block text-sm font-medium text-gray-900">
                  Fixed Coordinates
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  Predefined region boxes
                </span>
              </label>
            </div>
          </div>

          {/* Hybrid Option */}
          <div
            onClick={() => handleMethodChange('hybrid')}
            className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
              selectedMethod === 'hybrid'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <div className="flex items-center">
              <input
                type="radio"
                checked={selectedMethod === 'hybrid'}
                onChange={() => handleMethodChange('hybrid')}
                className="h-4 w-4 text-primary border-gray-300 focus:ring-blue-500"
              />
              <label className="ml-3">
                <span className="block text-sm font-medium text-gray-900">
                  Hybrid
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  YOLO with coordinate fallback
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* YOLO Configuration */}
      {(selectedMethod === 'yolo' || selectedMethod === 'hybrid') && (
        <div className="rounded-lg border border-gray-300 p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">YOLO Configuration</h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Model Path</label>
              <input
                type="text"
                value={templateData.region_config?.yolo_config?.model_path || ''}
                onChange={(e) => updateTemplateData({
                  region_config: {
                    ...templateData.region_config!,
                    yolo_config: {
                      ...templateData.region_config?.yolo_config!,
                      model_path: e.target.value
                    }
                  }
                })}
                placeholder="Models/bol_regions_best.pt"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Confidence Threshold</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={templateData.region_config?.yolo_config?.confidence_threshold || 0.60}
                onChange={(e) => updateTemplateData({
                  region_config: {
                    ...templateData.region_config!,
                    yolo_config: {
                      ...templateData.region_config?.yolo_config!,
                      confidence_threshold: parseFloat(e.target.value)
                    }
                  }
                })}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Class Mapping */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class Mapping
            </label>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs font-medium text-gray-700 px-2">
                <div>Class ID</div>
                <div>Region Name</div>
              </div>
              {Object.entries(templateData.region_config?.yolo_config?.class_mapping || {}).map(([classId, regionName]) => (
                <div key={classId} className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={classId}
                    disabled
                    className="px-3 py-2 bg-gray-100 rounded-md border border-gray-300 text-sm"
                  />
                  <input
                    type="text"
                    value={regionName as string}
                    disabled
                    className="px-3 py-2 bg-gray-100 rounded-md border border-gray-300 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-md bg-blue-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Detection Method Guide</h3>
            <div className="mt-2 text-sm text-primary">
              <ul className="list-disc space-y-1 pl-5">
                <li><strong>YOLO:</strong> Use existing trained models for automatic detection</li>
                <li><strong>Coordinates:</strong> Define fixed box positions for consistent layouts</li>
                <li><strong>Hybrid:</strong> Try YOLO first, fall back to coordinates if needed (recommended)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};