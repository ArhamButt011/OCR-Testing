"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';
import type { CoordinateRegion } from '@/app/context/TemplateContext';

export const Step4RegionConfig: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } = useTemplate();
  const [selectedMethod, setSelectedMethod] = useState<'yolo' | 'coordinates' | 'hybrid'>(
    templateData.region_config?.detection_method || 'hybrid'
  );
  const [isAddingRegion, setIsAddingRegion] = useState(false);
  const [editingRegionIndex, setEditingRegionIndex] = useState<number | null>(null);
  const [newRegion, setNewRegion] = useState<CoordinateRegion>({
    region_name: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const coordinateRegions = templateData.region_config?.coordinate_regions || [];
  const yoloConfig = templateData.region_config?.yolo_config;
  const hybridConfig = templateData.region_config?.hybrid_config;

  // FR-004 AC-004-1: Handle detection method change
  const handleMethodChange = (method: 'yolo' | 'coordinates' | 'hybrid') => {
    setSelectedMethod(method);
    
    // Initialize configurations based on method
    const updatedConfig: any = {
      detection_method: method,
    };

    // For YOLO or Hybrid, ensure YOLO config exists
    if (method === 'yolo' || method === 'hybrid') {
      updatedConfig.yolo_config = yoloConfig || {
        model_name: '',
        model_path: '',
        confidence_threshold: 0.60, // FR-004 AC-004-2: Default confidence 0.60
        iou_threshold: 0.45,
        classes_to_detect: [],
        class_mapping: {
          "0": "stamp",
          "1": "bill_of_lading",
          "2": "customer_order_info",
          "3": "signatures"
        }
      };
    }

    // For Coordinates or Hybrid, ensure coordinate regions exist
    if (method === 'coordinates' || method === 'hybrid') {
      updatedConfig.coordinate_regions = coordinateRegions.length > 0 
        ? coordinateRegions 
        : [];
    }

    // FR-004 AC-004-1: For Hybrid, initialize hybrid_config
    if (method === 'hybrid') {
      updatedConfig.hybrid_config = hybridConfig || {
        primary_method: 'yolo',
        fallback_method: 'coordinates'
      };
    }

    updateTemplateData({
      region_config: updatedConfig
    });
    clearError('region_config');
  };

  // FR-004 AC-004-3: Add/Update coordinate region
  const addOrUpdateRegion = () => {
    if (!newRegion.region_name.trim()) {
      setError('coordinate_regions', 'Region name is required');
      return;
    }

    const regions = [...coordinateRegions];
    
    if (editingRegionIndex !== null) {
      regions[editingRegionIndex] = newRegion;
    } else {
      regions.push(newRegion);
    }

    updateTemplateData({
      region_config: {
        ...templateData.region_config!,
        coordinate_regions: regions
      }
    });

    setNewRegion({ region_name: '', x: 0, y: 0, width: 0, height: 0 });
    setIsAddingRegion(false);
    setEditingRegionIndex(null);
    clearError('coordinate_regions');
  };

  const editRegion = (index: number) => {
    setNewRegion(coordinateRegions[index]);
    setEditingRegionIndex(index);
    setIsAddingRegion(true);
  };

  const removeRegion = (index: number) => {
    const regions = coordinateRegions.filter((_, i) => i !== index);
    updateTemplateData({
      region_config: {
        ...templateData.region_config!,
        coordinate_regions: regions
      }
    });
  };

  const cancelEdit = () => {
    setNewRegion({ region_name: '', x: 0, y: 0, width: 0, height: 0 });
    setIsAddingRegion(false);
    setEditingRegionIndex(null);
    clearError('coordinate_regions');
  };

  // Update YOLO config
  const updateYoloConfig = (field: string, value: any) => {
    updateTemplateData({
      region_config: {
        ...templateData.region_config!,
        yolo_config: {
          ...yoloConfig!,
          [field]: value
        }
      }
    });
  };

  // Update class mapping
  const updateClassMapping = (classId: string, regionName: string) => {
    const updatedMapping = {
      ...yoloConfig?.class_mapping,
      [classId]: regionName
    };
    
    updateYoloConfig('class_mapping', updatedMapping);
  };

  // Add new class to mapping
  const [newClassId, setNewClassId] = useState('');
  const [newClassName, setNewClassName] = useState('');
  
  const addClassMapping = () => {
    if (!newClassId || !newClassName) return;
    
    updateClassMapping(newClassId, newClassName);
    setNewClassId('');
    setNewClassName('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Region Detection Configuration</h2>
        <p className="mt-1 text-sm text-gray-600">
          FR-004: Configure OCR region detection method and parameters
        </p>
      </div>

      {/* FR-004 AC-004-1: Detection Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Detection Method * <span className="text-xs text-gray-500">(FR-004 AC-004-1)</span>
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
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <label className="ml-3">
                <span className="block text-sm font-medium text-gray-900">
                  YOLO Detection
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  Model-based detection
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
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <label className="ml-3">
                <span className="block text-sm font-medium text-gray-900">
                  Fixed Coordinates
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  Fixed ratio positions
                </span>
              </label>
            </div>
          </div>

          {/* Hybrid Option - RECOMMENDED */}
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
                className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <label className="ml-3">
                <span className="block text-sm font-medium text-gray-900 flex items-center">
                  Hybrid
                  <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                    Recommended
                  </span>
                </span>
                <span className="block text-xs text-gray-500 mt-1">
                  YOLO + coordinate fallback
                </span>
              </label>
            </div>
          </div>
        </div>

        {errors.region_config && (
          <p className="mt-2 text-sm text-red-600">{errors.region_config}</p>
        )}
      </div>

      {/* FR-004 AC-004-2: YOLO Configuration with Confidence Threshold */}
      {(selectedMethod === 'yolo' || selectedMethod === 'hybrid') && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            YOLO Configuration <span className="text-xs text-gray-500">(Required for {selectedMethod})</span>
          </h3>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Model Name</label>
              <input
                type="text"
                value={yoloConfig?.model_name || ''}
                onChange={(e) => updateYoloConfig('model_name', e.target.value)}
                placeholder="BOL Regions Model"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Model Path *</label>
              <input
                type="text"
                value={yoloConfig?.model_path || ''}
                onChange={(e) => updateYoloConfig('model_path', e.target.value)}
                placeholder="Models/bol_regions_best.pt"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* FR-004 AC-004-2: Confidence Threshold (default 0.60) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Confidence Threshold * <span className="text-xs text-gray-500">(FR-004 AC-004-2)</span>
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={yoloConfig?.confidence_threshold || 0.60}
                onChange={(e) => updateYoloConfig('confidence_threshold', parseFloat(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">Default: 0.60</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">IOU Threshold</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={yoloConfig?.iou_threshold || 0.45}
                onChange={(e) => updateYoloConfig('iou_threshold', parseFloat(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Class Mapping */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Class Mapping (Class ID → Region Name)
            </label>
            
            {/* Existing Mappings */}
            <div className="space-y-2 mb-3">
              {Object.entries(yoloConfig?.class_mapping || {}).map(([classId, regionName]) => (
                <div key={classId} className="grid grid-cols-3 gap-2 items-center">
                  <input
                    type="text"
                    value={classId}
                    readOnly
                    className="px-3 py-2 bg-gray-100 rounded-md border border-gray-300 text-sm"
                  />
                  <input
                    type="text"
                    value={regionName as string}
                    onChange={(e) => updateClassMapping(classId, e.target.value)}
                    className="px-3 py-2 bg-white rounded-md border border-gray-300 text-sm"
                  />
                  <button
                    onClick={() => {
                      const updated = { ...yoloConfig?.class_mapping };
                      delete updated[classId];
                      updateYoloConfig('class_mapping', updated);
                    }}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {/* Add New Mapping */}
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={newClassId}
                onChange={(e) => setNewClassId(e.target.value)}
                placeholder="Class ID (e.g., 0)"
                className="px-3 py-2 bg-white rounded-md border border-gray-300 text-sm"
              />
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Region name"
                className="px-3 py-2 bg-white rounded-md border border-gray-300 text-sm"
              />
              <button
                onClick={addClassMapping}
                className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FR-004 AC-004-3: Coordinate Regions (Fallback for Hybrid) */}
      {(selectedMethod === 'coordinates' || selectedMethod === 'hybrid') && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            Coordinate Regions <span className="text-xs text-gray-500">(FR-004 AC-004-3 - {selectedMethod === 'hybrid' ? 'Fallback Required' : 'Primary Method'})</span>
          </h3>

          {!isAddingRegion && (
            <button
              onClick={() => setIsAddingRegion(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Region
            </button>
          )}

          {/* Add/Edit Region Form */}
          {isAddingRegion && (
            <div className="rounded-lg border border-orange-300 bg-white p-4 space-y-4">
              <h4 className="text-sm font-medium text-gray-900">
                {editingRegionIndex !== null ? 'Edit Region' : 'Add New Region'}
              </h4>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Region Name *</label>
                  <input
                    type="text"
                    value={newRegion.region_name}
                    onChange={(e) => setNewRegion({ ...newRegion, region_name: e.target.value })}
                    placeholder="stamp"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">X Position (pixels)</label>
                  <input
                    type="number"
                    value={newRegion.x}
                    onChange={(e) => setNewRegion({ ...newRegion, x: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Y Position (pixels)</label>
                  <input
                    type="number"
                    value={newRegion.y}
                    onChange={(e) => setNewRegion({ ...newRegion, y: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Width (pixels)</label>
                  <input
                    type="number"
                    value={newRegion.width}
                    onChange={(e) => setNewRegion({ ...newRegion, width: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Height (pixels)</label>
                  <input
                    type="number"
                    value={newRegion.height}
                    onChange={(e) => setNewRegion({ ...newRegion, height: parseInt(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {errors.coordinate_regions && (
                <p className="text-sm text-red-600">{errors.coordinate_regions}</p>
              )}

              <div className="flex justify-end space-x-3">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={addOrUpdateRegion}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
                >
                  {editingRegionIndex !== null ? 'Update Region' : 'Add Region'}
                </button>
              </div>
            </div>
          )}

          {/* Regions List */}
          {coordinateRegions.length > 0 && (
            <div className="bg-white border border-orange-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-orange-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">X</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Y</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Width</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Height</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coordinateRegions.map((region, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{region.region_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{region.x}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{region.y}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{region.width}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{region.height}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <button
                          onClick={() => editRegion(index)}
                          className="text-blue-600 hover:text-blue-700 mr-3"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeRegion(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {coordinateRegions.length === 0 && !isAddingRegion && selectedMethod === 'hybrid' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Fallback coordinates required for Hybrid mode
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Please add at least one coordinate region as fallback when YOLO detection fails.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FR-004: Info Box */}
      <div className="rounded-md bg-blue-50 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">FR-004: Detection Method Guide</h3>
            <div className="mt-2 text-sm text-blue-700 space-y-1">
              <p><strong>YOLO (AC-004-1):</strong> AI model detects regions automatically. Requires trained model.</p>
              <p><strong>Coordinates (AC-004-1):</strong> Fixed pixel positions. Best for consistent document layouts.</p>
              <p><strong>Hybrid (AC-004-1) - Recommended:</strong> Tries YOLO first, falls back to coordinates if confidence {'<'} threshold.</p>
              <p className="mt-2"><strong>AC-004-2:</strong> Default confidence threshold is 0.60</p>
              <p><strong>AC-004-3:</strong> Fallback coordinates use pixel positions (x, y, width, height)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};