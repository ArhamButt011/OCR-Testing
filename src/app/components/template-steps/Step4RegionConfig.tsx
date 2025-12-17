"use client";

import React, { useState, useEffect } from 'react';
import { useTemplate } from '@/app/context/TemplateContext';
import { VisualRegionEditor } from './VisualRegionEditor';
import { FaInfo } from 'react-icons/fa'

interface CoordinateRegion {
  region_name: string;
  x1_ratio: number;
  y1_ratio: number;
  x2_ratio: number;
  y2_ratio: number;
  confidence_threshold?: number;
}

interface YoloClass {
  class_id: string;
  region_name: string;
  confidence_threshold?: number;
}

export const Step4RegionConfig: React.FC = () => {
  const { templateData, updateTemplateData, errors, setError, clearError } = useTemplate();
  
  // ✅ Initialize with hybrid by default, or use existing detection_method
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

  // YOLO-related states
  const [newYoloClass, setNewYoloClass] = useState<YoloClass>({
    class_id: '',
    region_name: '',
    confidence_threshold: undefined,
  });
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [editingClassId, setEditingClassId] = useState<string | null>(null);

  // ✅ FIX 1: Set detection_method to 'hybrid' on component mount if not already set
  useEffect(() => {
    if (!templateData.region_config?.detection_method) {
      console.log('🔧 Setting default detection_method to hybrid');
      
      updateTemplateData({
        region_config: {
          detection_method: 'hybrid',
          coordinate_regions: [],
          yolo_config: {
            model_name: '',
            model_path: '',
            confidence_threshold: 0.60,
            iou_threshold: 0.45,
            classes: [],
          },
          hybrid_config: {
            primary_method: 'yolo',
            fallback_method: 'coordinates'
          }
        }
      });
      
      setSelectedMethod('hybrid');
    }
  }, []); // Run once on mount

  const coordinateRegions = templateData.region_config?.coordinate_regions || [];
  const yoloConfig = templateData.region_config?.yolo_config;
  const hybridConfig = templateData.region_config?.hybrid_config;
  const referenceImages = templateData.identification?.reference_images || [];

  // ✅ FIX 2: Preserve data when changing detection method
  const handleMethodChange = (method: 'yolo' | 'coordinates' | 'hybrid') => {
    setSelectedMethod(method);
    
    const updatedConfig: any = {
      detection_method: method,
      // ✅ Always preserve existing coordinate_regions
      coordinate_regions: coordinateRegions,
      // ✅ Always preserve existing yolo_config
      yolo_config: yoloConfig || {
        model_name: '',
        model_path: '',
        confidence_threshold: 0.60,
        iou_threshold: 0.45,
        classes: [],
      }
    };

    // Only add hybrid_config when method is hybrid
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
    clearError('detection_method');
  };

  const handleRegionsChange = (regions: CoordinateRegion[]) => {
    updateTemplateData({
      region_config: {
        ...templateData.region_config!,
        coordinate_regions: regions
      }
    });
  };

  const addOrUpdateRegion = () => {
    if (!newRegion.region_name.trim()) {
      setError('coordinate_regions', 'Region name is required');
      return;
    }

    if (newRegion.x1_ratio < 0 || newRegion.x1_ratio > 1 ||
        newRegion.y1_ratio < 0 || newRegion.y1_ratio > 1 ||
        newRegion.x2_ratio < 0 || newRegion.x2_ratio > 1 ||
        newRegion.y2_ratio < 0 || newRegion.y2_ratio > 1) {
      setError('coordinate_regions', 'All ratio values must be between 0 and 1');
      return;
    }

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

  const showCanvas = (selectedMethod === 'coordinates' || selectedMethod === 'hybrid') && referenceImages.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Region Detection Configuration</h2>
        <p className="mt-1 text-sm text-gray-600">
          Configure how regions should be detected in your documents
        </p>
      </div>

      {/* Detection Method Selection */}
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
                ? 'border-primary bg-blue-50 shadow-md'
                : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start">
              <input
                type="radio"
                checked={selectedMethod === 'yolo'}
                onChange={() => handleMethodChange('yolo')}
                className="h-4 w-4 mt-0.5 text-primary border-gray-300 focus:ring-primary"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="block text-sm font-medium text-gray-900">
                    YOLO Detection
                  </span>
                  <div className="relative group">
                    <FaInfo className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      AI model automatically detects regions in documents using trained YOLO models
                    </div>
                  </div>
                </div>
                <span className="block text-xs text-gray-500 mt-1">
                  Model-based detection
                </span>
              </div>
            </div>
          </div>

          {/* Coordinates Option */}
          <div
            onClick={() => handleMethodChange('coordinates')}
            className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
              selectedMethod === 'coordinates'
                ? 'border-primary bg-blue-50 shadow-md'
                : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start">
              <input
                type="radio"
                checked={selectedMethod === 'coordinates'}
                onChange={() => handleMethodChange('coordinates')}
                className="h-4 w-4 mt-0.5 text-primary border-gray-300 focus:ring-primary"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="block text-sm font-medium text-gray-900">
                    Fixed Coordinates
                  </span>
                  <div className="relative group">
                    <FaInfo className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Use predefined coordinate positions (0-1 ratios) for consistent document layouts
                    </div>
                  </div>
                </div>
                <span className="block text-xs text-gray-500 mt-1">
                  Ratio-based positions (0-1)
                </span>
              </div>
            </div>
          </div>

          {/* Hybrid Option */}
          <div
            onClick={() => handleMethodChange('hybrid')}
            className={`relative rounded-lg border-2 p-4 cursor-pointer transition-all ${
              selectedMethod === 'hybrid'
                ? 'border-primary bg-blue-50 shadow-md'
                : 'border-gray-300 hover:border-gray-400 hover:shadow-sm'
            }`}
          >
            <div className="flex items-start">
              <input
                type="radio"
                checked={selectedMethod === 'hybrid'}
                onChange={() => handleMethodChange('hybrid')}
                className="h-4 w-4 mt-0.5 text-primary border-gray-300 focus:ring-primary"
              />
              <div className="ml-3 flex-1">
                <div className="flex items-center gap-2">
                  <span className="block text-sm font-medium text-gray-900">
                    Hybrid
                  </span>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded font-medium">
                    Recommended
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="relative group">
                    <FaInfo className="w-4 h-4 text-gray-400 cursor-help" />
                    <div className="absolute left-0 top-6 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      Combines YOLO detection with coordinate fallback for maximum reliability
                    </div>
                  </div>
                  <span className="block text-xs text-gray-500">
                    YOLO + coordinate fallback
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {errors.detection_method && (
          <p className="mt-2 text-sm text-red-600">{errors.detection_method}</p>
        )}
      </div>

      {/* YOLO Configuration */}
      {(selectedMethod === 'yolo' || selectedMethod === 'hybrid') && (
        <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              YOLO Configuration
            </h3>
            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
              Required for {selectedMethod === 'yolo' ? 'YOLO' : 'Hybrid'} mode
            </span>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Model Name</label>
              <input
                type="text"
                value={yoloConfig?.model_name || ''}
                onChange={(e) => updateYoloConfig('model_name', e.target.value)}
                placeholder="BOL Regions Model"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Model Path *</label>
              <input
                type="text"
                value={yoloConfig?.model_path || ''}
                onChange={(e) => updateYoloConfig('model_path', e.target.value)}
                placeholder="models/bol_regions_best.pt"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Global Confidence Threshold *
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={yoloConfig?.confidence_threshold || 0.60}
                onChange={(e) => updateYoloConfig('confidence_threshold', parseFloat(e.target.value))}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">Applied to all regions unless overridden (default: 0.60)</p>
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
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">Intersection over Union threshold (default: 0.45)</p>
            </div>
          </div>

          {/* YOLO Classes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YOLO Classes
            </label>

            {!isAddingClass && (
              <button
                onClick={() => setIsAddingClass(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary mb-3 transition-colors"
              >
                <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Class
              </button>
            )}

            {isAddingClass && (
              <div className="rounded-lg border border-blue-300 bg-white p-4 space-y-4 mb-3 shadow-sm">
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
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Region Name *</label>
                    <input
                      type="text"
                      value={newYoloClass.region_name}
                      onChange={(e) => setNewYoloClass({ ...newYoloClass, region_name: e.target.value })}
                      placeholder="stamp"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Confidence Threshold
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={newYoloClass.confidence_threshold ?? ''}
                      onChange={(e) => setNewYoloClass({ 
                        ...newYoloClass, 
                        confidence_threshold: e.target.value ? parseFloat(e.target.value) : undefined 
                      })}
                      placeholder="Uses global"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-500">Optional override per class</p>
                  </div>
                </div>

                {errors.yolo_config && (
                  <p className="text-sm text-red-600">{errors.yolo_config}</p>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={cancelClassEdit}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addOrUpdateYoloClass}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary transition-colors"
                  >
                    {editingClassId ? 'Update Class' : 'Add Class'}
                  </button>
                </div>
              </div>
            )}

            {(yoloConfig?.classes && yoloConfig.classes.length > 0) && (
              <div className="bg-white border border-blue-200 rounded-lg overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-blue-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Class ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Region Name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Confidence</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {yoloConfig.classes.map((yoloClass) => (
                      <tr key={yoloClass.class_id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-mono text-gray-900">{yoloClass.class_id}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{yoloClass.region_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {yoloClass.confidence_threshold !== undefined 
                            ? yoloClass.confidence_threshold.toFixed(2)
                            : <span className="text-gray-400 italic">Global ({yoloConfig.confidence_threshold?.toFixed(2)})</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-sm text-right space-x-3">
                          <button
                            onClick={() => editYoloClass(yoloClass.class_id)}
                            className="text-primary hover:text-blue-800 font-medium transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => removeYoloClass(yoloClass.class_id)}
                            className="text-red-600 hover:text-red-800 font-medium transition-colors"
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

            {(!yoloConfig?.classes || yoloConfig.classes.length === 0) && !isAddingClass && (
              <div className="text-center py-6 bg-white border-2 border-dashed border-blue-200 rounded-lg">
                <p className="text-sm text-gray-600">No YOLO classes defined yet. Click "Add Class" to get started.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Canvas Editor */}
      {showCanvas && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-6">
          <VisualRegionEditor
            referenceImages={referenceImages}
            regions={coordinateRegions}
            onRegionsChange={handleRegionsChange}
            detectionMethod={selectedMethod}
          />
        </div>
      )}

      {/* Manual Coordinate Regions */}
      {(selectedMethod === 'coordinates' || selectedMethod === 'hybrid') && (
        <div className="rounded-lg border-2 border-orange-300 bg-orange-50 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Coordinate Regions
            </h3>
            <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded">
              {selectedMethod === 'hybrid' ? 'Fallback method' : 'Primary method'}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {selectedMethod === 'hybrid' 
              ? 'These coordinates will be used when YOLO confidence is below threshold'
              : 'Define regions using fixed ratio positions (0-1 scale)'
            }
          </p>

          {!isAddingRegion && (
            <button
              onClick={() => setIsAddingRegion(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 transition-colors"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Region Manually
            </button>
          )}

          {isAddingRegion && (
            <div className="rounded-lg border border-orange-300 bg-white p-4 space-y-4 shadow-sm">
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
                    placeholder="e.g., stamp, invoice_number"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">x1 (Left) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={newRegion.x1_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, x1_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Range: 0.000 - 1.000</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">y1 (Top) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={newRegion.y1_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, y1_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Range: 0.000 - 1.000</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">x2 (Right) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={newRegion.x2_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, x2_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be greater than x1</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">y2 (Bottom) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    max="1"
                    value={newRegion.y2_ratio}
                    onChange={(e) => setNewRegion({ ...newRegion, y2_ratio: parseFloat(e.target.value) || 0 })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be greater than y1</p>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Confidence Threshold (Optional)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    value={newRegion.confidence_threshold ?? ''}
                    onChange={(e) => setNewRegion({ 
                      ...newRegion, 
                      confidence_threshold: e.target.value ? parseFloat(e.target.value) : undefined
                    })}
                    placeholder="e.g., 0.60"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {selectedMethod === 'hybrid' 
                      ? 'Falls back to these coordinates if YOLO confidence is below this threshold'
                      : 'Minimum confidence required for this region'
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
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addOrUpdateRegion}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
                >
                  {editingRegionIndex !== null ? 'Update Region' : 'Add Region'}
                </button>
              </div>
            </div>
          )}

          {coordinateRegions.length > 0 && (
            <div className="bg-white border border-orange-200 rounded-lg overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-orange-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Region</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">x1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">y1</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">x2</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">y2</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Confidence</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {coordinateRegions.map((region, index) => (
                    <tr key={index} className="hover:bg-orange-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{region.region_name}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.x1_ratio.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.y1_ratio.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.x2_ratio.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm font-mono text-gray-600">{region.y2_ratio.toFixed(3)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {region.confidence_threshold !== undefined
                          ? region.confidence_threshold.toFixed(2)
                          : <span className="text-gray-400 italic">Global</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-sm text-right space-x-3">
                        <button
                          onClick={() => editRegion(index)}
                          className="text-orange-600 hover:text-orange-800 font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeRegion(index)}
                          className="text-red-600 hover:text-red-800 font-medium transition-colors"
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
                <svg className="h-5 w-5 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Fallback coordinates required
                  </h3>
                  <p className="mt-1 text-sm text-yellow-700">
                    Hybrid mode requires at least one coordinate region as fallback. 
                    {referenceImages.length > 0 
                      ? ' Draw regions on the canvas above or add them manually.'
                      : ' Please upload reference images in Step 2 first, then draw regions on the canvas.'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {coordinateRegions.length === 0 && !isAddingRegion && selectedMethod === 'coordinates' && referenceImages.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <FaInfo className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    No reference images available
                  </h3>
                  <p className="mt-1 text-sm text-primary">
                    Upload reference images in Step 2 to use the visual region editor, or add regions manually using the form above.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};