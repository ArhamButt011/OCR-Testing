"use client";

import React, { useState } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';

// FR-004 AC-004-3: Updated to use ratio-based coordinates (0-1 scale)
interface CoordinateRegion {
  region_name: string;
  x1_ratio: number;  // Left edge (0-1)
  y1_ratio: number;  // Top edge (0-1)
  x2_ratio: number;  // Right edge (0-1)
  y2_ratio: number;  // Bottom edge (0-1)
  confidence_threshold?: number; // FR-004 AC-004-2: Per-region confidence (optional override)
}

// FR-004 AC-004-2: YOLO class with per-region confidence
interface YoloClass {
  class_id: string;
  region_name: string;
  confidence_threshold?: number; // Per-region confidence override (default: 0.60)
}

export const Step4RegionConfig: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } = useTemplate();
  const [selectedMethod, setSelectedMethod] = useState<'yolo' | 'coordinates' | 'hybrid'>(
    templateData.region_config?.detection_method || 'hybrid'
  );
  const [isAddingRegion, setIsAddingRegion] = useState(false);
  const [editingRegionIndex, setEditingRegionIndex] = useState<number | null>(null);
  const [newRegion, setNewRegion] = useState<CoordinateRegion>({
    region_name: '',
    x1_ratio: 0,
    y1_ratio: 0,
    x2_ratio: 0,
    y2_ratio: 0,
    confidence_threshold: undefined,
  });

  // For YOLO class management
  const [newYoloClass, setNewYoloClass] = useState<YoloClass>({
    class_id: '',
    region_name: '',
    confidence_threshold: undefined,
  });
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  const coordinateRegions = templateData.region_config?.coordinate_regions || [];
  const yoloConfig = templateData.region_config?.yolo_config;
  const hybridConfig = templateData.region_config?.hybrid_config;

  // FR-004 AC-004-1: Handle detection method change
  const handleMethodChange = (method: 'yolo' | 'coordinates' | 'hybrid') => {
    setSelectedMethod(method);
    
    const updatedConfig: any = {
      detection_method: method,
    };

    // For YOLO or Hybrid, ensure YOLO config exists
    if (method === 'yolo' || method === 'hybrid') {
      updatedConfig.yolo_config = yoloConfig || {
        model_name: '',
        model_path: '',
        confidence_threshold: 0.60, // FR-004 AC-004-2: Global default
        iou_threshold: 0.45,
        classes: [], // New structure with per-region confidence
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

  // FR-004 AC-004-3: Add/Update coordinate region with ratio-based coordinates
  const addOrUpdateRegion = () => {
    if (!newRegion.region_name.trim()) {
      setError('coordinate_regions', 'Region name is required');
      return;
    }

    // Validate ratios are between 0 and 1
    if (newRegion.x1_ratio < 0 || newRegion.x1_ratio > 1 ||
        newRegion.y1_ratio < 0 || newRegion.y1_ratio > 1 ||
        newRegion.x2_ratio < 0 || newRegion.x2_ratio > 1 ||
        newRegion.y2_ratio < 0 || newRegion.y2_ratio > 1) {
      setError('coordinate_regions', 'All ratio values must be between 0 and 1');
      return;
    }

    // Validate x2 > x1 and y2 > y1
    if (newRegion.x2_ratio <= newRegion.x1_ratio) {
      setError('coordinate_regions', 'x2_ratio must be greater than x1_ratio');
      return;
    }

    if (newRegion.y2_ratio <= newRegion.y1_ratio) {
      setError('coordinate_regions', 'y2_ratio must be greater than y1_ratio');
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

    setNewRegion({ 
      region_name: '', 
      x1_ratio: 0, 
      y1_ratio: 0, 
      x2_ratio: 0, 
      y2_ratio: 0,
      confidence_threshold: undefined,
    });
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
    setNewRegion({ 
      region_name: '', 
      x1_ratio: 0, 
      y1_ratio: 0, 
      x2_ratio: 0, 
      y2_ratio: 0,
      confidence_threshold: undefined,
    });
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

  // FR-004 AC-004-2: Add/Update YOLO class with per-region confidence
  const addOrUpdateYoloClass = () => {
    if (!newYoloClass.class_id || !newYoloClass.region_name) {
      setError('yolo_config', 'Class ID and region name are required');
      return;
    }

    const classes = [...(yoloConfig?.classes || [])];
    
    if (editingClassId !== null) {
      const index = classes.findIndex(c => c.class_id === editingClassId);
      if (index !== -1) {
        classes[index] = newYoloClass;
      }
    } else {
      // Check if class_id already exists
      if (classes.some(c => c.class_id === newYoloClass.class_id)) {
        setError('yolo_config', 'Class ID already exists');
        return;
      }
      classes.push(newYoloClass);
    }

    updateYoloConfig('classes', classes);
    
    setNewYoloClass({ class_id: '', region_name: '', confidence_threshold: undefined });
    setIsAddingClass(false);
    setEditingClassId(null);
    clearError('yolo_config');
  };

  const editYoloClass = (classId: string) => {
    const classObj = yoloConfig?.classes?.find(c => c.class_id === classId);
    if (classObj) {
      setNewYoloClass(classObj);
      setEditingClassId(classId);
      setIsAddingClass(true);
    }
  };

  const removeYoloClass = (classId: string) => {
    const classes = (yoloConfig?.classes || []).filter(c => c.class_id !== classId);
    updateYoloConfig('classes', classes);
  };

  const cancelClassEdit = () => {
    setNewYoloClass({ class_id: '', region_name: '', confidence_threshold: undefined });
    setIsAddingClass(false);
    setEditingClassId(null);
    clearError('yolo_config');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Region Detection Configuration</h2>
        <p className="mt-1 text-sm text-gray-600">
          FR-004: Configure OCR region detection with ratio-based coordinates and per-region confidence thresholds
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
                  Ratio-based positions (0-1)
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

      {/* FR-004 AC-004-2: YOLO Configuration with Per-Region Confidence */}
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
                placeholder="models/bol_regions_best.pt"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* FR-004 AC-004-2: Global Confidence Threshold (default 0.60) */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Global Confidence Threshold * <span className="text-xs text-gray-500">(AC-004-2: Default 0.60)</span>
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
              <p className="mt-1 text-xs text-gray-500">Applied to all regions unless overridden</p>
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

          {/* FR-004 AC-004-2: YOLO Classes with Per-Region Confidence */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YOLO Classes <span className="text-xs text-gray-500">(AC-004-2: Per-Region Confidence)</span>
            </label>

            {!isAddingClass && (
              <button
                onClick={() => setIsAddingClass(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 mb-3"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Class
              </button>
            )}

            {/* Add/Edit Class Form */}
            {isAddingClass && (
              <div className="rounded-lg border border-blue-300 bg-white p-4 space-y-4 mb-3">
                <h4 className="text-sm font-medium text-gray-900">
                  {editingClassId ? 'Edit Class' : 'Add New Class'}
                </h4>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Class ID *</label>
                    <input
                      type="text"
                      value={newYoloClass.class_id}
                      onChange={(e) => setNewYoloClass({ ...newYoloClass, class_id: e.target.value })}
                      placeholder="0"
                      disabled={!!editingClassId}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Region Name *</label>
                    <input
                      type="text"
                      value={newYoloClass.region_name}
                      onChange={(e) => setNewYoloClass({ ...newYoloClass, region_name: e.target.value })}
                      placeholder="stamp"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Confidence <span className="text-xs text-gray-500">(optional override)</span>
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={newYoloClass.confidence_threshold || ''}
                      onChange={(e) => setNewYoloClass({ 
                        ...newYoloClass, 
                        confidence_threshold: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                      placeholder="Uses global"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {errors.yolo_config && (
                  <p className="text-sm text-red-600">{errors.yolo_config}</p>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={cancelClassEdit}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addOrUpdateYoloClass}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    {editingClassId ? 'Update Class' : 'Add Class'}
                  </button>
                </div>
              </div>
            )}

            {/* Classes List */}
            {(yoloConfig?.classes && yoloConfig.classes.length > 0) && (
              <div className="bg-white border border-blue-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Class ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Region Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Confidence</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {yoloConfig.classes.map((yoloClass) => (
                      <tr key={yoloClass.class_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{yoloClass.class_id}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{yoloClass.region_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {yoloClass.confidence_threshold !== undefined 
                            ? yoloClass.confidence_threshold.toFixed(2)
                            : <span className="text-gray-400 italic">Global ({yoloConfig.confidence_threshold})</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          <button
                            onClick={() => editYoloClass(yoloClass.class_id)}
                            className="text-blue-600 hover:text-blue-700 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeYoloClass(yoloClass.class_id)}
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
          </div>
        </div>
      )}

      {/* FR-004 AC-004-3: Coordinate Regions with Ratio-Based Positions */}
      {(selectedMethod === 'coordinates' || selectedMethod === 'hybrid') && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-6 space-y-4">
          <h3 className="text-lg font-medium text-gray-900">
            Coordinate Regions <span className="text-xs text-gray-500">(AC-004-3: Ratio-Based 0-1 Scale)</span>
          </h3>
          <p className="text-sm text-gray-600">
            {selectedMethod === 'hybrid' 
              ? 'Fallback coordinates when YOLO confidence is below threshold'
              : 'Primary detection method using fixed ratio positions'
            }
          </p>

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
                  <label className="block text-sm font-medium text-gray-700">
                    x1_ratio * <span className="text-xs text-gray-500">(left edge, 0-1)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={newRegion.x1_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, x1_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">0 = far left, 1 = far right</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    y1_ratio * <span className="text-xs text-gray-500">(top edge, 0-1)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={newRegion.y1_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, y1_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">0 = top, 1 = bottom</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    x2_ratio * <span className="text-xs text-gray-500">(right edge, 0-1)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={newRegion.x2_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, x2_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be {'>'} x1_ratio</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    y2_ratio * <span className="text-xs text-gray-500">(bottom edge, 0-1)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={newRegion.y2_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, y2_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be {'>'} y1_ratio</p>
                </div>

                {/* Confidence Threshold - Show for BOTH coordinates and hybrid modes */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Confidence Threshold {selectedMethod === 'hybrid' ? '(optional, for fallback)' : '(optional)'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={newRegion.confidence_threshold || ''}
                    onChange={(e) => setNewRegion({ 
                      ...newRegion, 
                      confidence_threshold: e.target.value ? parseFloat(e.target.value) : undefined 
                    })}
                    placeholder={selectedMethod === 'hybrid' ? 'Uses YOLO global threshold' : 'Optional threshold for this region'}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedMethod === 'hybrid' 
                      ? 'Falls back to these coordinates if YOLO confidence < this threshold'
                      : 'Minimum confidence required for this region (default: 0.60)'
                    }
                  </p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">x1_ratio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">y1_ratio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">x2_ratio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">y2_ratio</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Confidence</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coordinateRegions.map((region, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{region.region_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.x1_ratio.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.y1_ratio.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.x2_ratio.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.y2_ratio.toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {region.confidence_threshold !== undefined
                          ? region.confidence_threshold.toFixed(2)
                          : <span className="text-gray-400 italic">Global</span>
                        }
                      </td>
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
                    Please add at least one coordinate region as fallback when YOLO detection fails or confidence is below threshold.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Example Visual Guide */}
          <div className="bg-white border border-orange-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-2">📐 Ratio Position Guide</h4>
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-600">
              <div>
                <strong>Example: Bottom-right stamp</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>x1_ratio: 0.70 (starts 70% from left)</li>
                  <li>y1_ratio: 0.80 (starts 80% from top)</li>
                  <li>x2_ratio: 0.95 (ends 95% from left)</li>
                  <li>y2_ratio: 0.95 (ends 95% from top)</li>
                </ul>
              </div>
              <div>
                <strong>Example: Center signature</strong>
                <ul className="mt-1 space-y-1 list-disc list-inside">
                  <li>x1_ratio: 0.40 (starts 40% from left)</li>
                  <li>y1_ratio: 0.45 (starts 45% from top)</li>
                  <li>x2_ratio: 0.60 (ends 60% from left)</li>
                  <li>y2_ratio: 0.55 (ends 55% from top)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FR-004: Info Box */}
      <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">FR-004 Implementation Guide</h3>
            <div className="mt-2 text-sm text-blue-700 space-y-1">
              <p><strong>AC-004-1 (Methods):</strong> YOLO (model-based), Coordinates (fixed ratios), Hybrid (YOLO + fallback)</p>
              <p><strong>AC-004-2 (Confidence):</strong> Global default 0.60, customizable per-region for YOLO classes and coordinate fallbacks</p>
              <p><strong>AC-004-3 (Ratio Coordinates):</strong> All coordinates use 0-1 scale (x1_ratio, y1_ratio, x2_ratio, y2_ratio) for resolution independence</p>
              <p className="mt-2 font-medium">💡 <strong>Hybrid Mode Best Practice:</strong> Set YOLO as primary with coordinate fallback for maximum reliability</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};