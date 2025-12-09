"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================================
// TYPES
// ============================================================================

export interface ReferenceImage {
  image_id: string;
  file_path: string;
  file?: File;
  preview?: string;
}

export interface CoordinateRegion {
  region_name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface YoloConfig {
  model_name: string;
  model_path: string;
  confidence_threshold: number;
  iou_threshold?: number;
  classes_to_detect: string[];
  class_mapping: Record<string, string>;
}

export interface HybridConfig {
  primary_method: 'yolo' | 'coordinates';
  fallback_method: 'yolo' | 'coordinates';
}

export interface RegionConfig {
  detection_method: 'yolo' | 'coordinates' | 'hybrid';
  coordinate_regions?: CoordinateRegion[];
  yolo_config?: YoloConfig;
  hybrid_config?: HybridConfig;
}

export interface PromptPostProcessing {
  transforms?: Array<{
    field: string;
    transform: string;
    description?: string;
  }>;
  validations?: Array<{
    field: string;
    validate: string;
    reject_values?: any[];
    action?: string;
    reason?: string;
  }>;
}

export interface RegionPrompt {
  prompt_text: string;
  expected_output_schema: Record<string, string>;
  post_processing?: PromptPostProcessing;
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  data_type: 'string' | 'integer' | 'float' | 'boolean' | 'date';
  required?: boolean;
  transformation?: {
    map?: Record<string, any>;
    function?: string;
    format?: string;
  };
  fallback_source?: string;
  default_value?: any;
  description?: string;
  validation?: {
    regex?: string;
    max_length?: number;
    min?: number;
    max?: number;
  };
}

export interface ConditionalRule {
  rule_name: string;
  condition: string;
  action?: string;
  actions?: any[];
  field?: string;
  message?: string;
  formula?: string;
  expected?: string;
  on_mismatch?: any;
}

export interface PostProcessingRules {
  conditional_rules?: ConditionalRule[];
  transformation_rules?: Array<{
    field: string;
    transform: string;
  }>;
  cross_field_rules?: any[];
}

export interface TemplateData {
  // Step 1: Basic Info
  template_id?: string;
  template_name?: string;
  category?: 'Stamp' | 'Notation' | 'Receipt';
  version?: string;
  description?: string;
  
  // Step 2: Reference Images (handled separately)
  
  // Step 3: Identification
  identification?: {
    reference_images?: ReferenceImage[];
    text_patterns?: string[];
  };
  
  // Step 4: Region Configuration
  region_config?: RegionConfig;
  
  // Step 5: Prompts
  prompts?: Record<string, RegionPrompt>;
  
  // Step 6: Field Mapping
  field_mapping?: Record<string, FieldMapping>;
  
  // Step 7: Post-Processing Rules (optional)
  post_processing_rules?: PostProcessingRules;
}

interface TemplateContextType {
  // State
  currentStep: number;
  totalSteps: number;
  templateData: TemplateData;
  draftId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  errors: Record<string, string>;
  
  // Actions
  setCurrentStep: (step: number) => void;
  updateTemplateData: (data: Partial<TemplateData>) => void;
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  validateStep: (step: number) => boolean;
  submitTemplate: () => Promise<string>;
  resetTemplate: () => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

export const useTemplate = () => {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error('useTemplate must be used within TemplateProvider');
  }
  return context;
};

// ============================================================================
// PROVIDER
// ============================================================================

interface TemplateProviderProps {
  children: React.ReactNode;
  initialDraftId?: string;
}

export const TemplateProvider: React.FC<TemplateProviderProps> = ({ 
  children, 
  initialDraftId 
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const [templateData, setTemplateData] = useState<TemplateData>({
    version: '1.0.0',
    category: 'Stamp',
  });
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Debounce timer ref
  const saveTimerRef = useRef<NodeJS.Timeout>();
  const hasUnsavedChanges = useRef(false);

  // ============================================================================
  // AUTO-SAVE WITH DEBOUNCING
  // ============================================================================

  const saveDraft = useCallback(async () => {
    if (!hasUnsavedChanges.current) return;
    
    setIsSaving(true);
    try {
      const response = await fetch('/api/templates/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          draft_id: draftId,
          step_number: currentStep,
          total_steps: totalSteps,
          partial_data: templateData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save draft');
      }

      const data = await response.json();
      
      if (!draftId && data.draft_id) {
        setDraftId(data.draft_id);
        // window.history.replaceState(
        //   null, 
        //   '', 
        //   `/admin/templates/create?draft=${data.draft_id}`
        // );
      }

      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      console.log('Draft saved successfully');
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [draftId, currentStep, templateData]);

  // Debounced auto-save effect
  useEffect(() => {
    if (hasUnsavedChanges.current) {
      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Set new timer (2 seconds debounce)
      saveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, 2000);
    }

    // Cleanup
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [templateData, saveDraft]);

  // ============================================================================
  // LOAD DRAFT
  // ============================================================================

  const loadDraft = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/templates/draft?draft_id=${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to load draft');
      }

      const draft = await response.json();
      
      setDraftId(draft.draft_id);
      setCurrentStep(draft.current_step || 1);
      setTemplateData(draft.partial_data || {});
      setLastSaved(new Date(draft.metadata.last_saved_at));
      
      console.log('✅ Draft loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load draft:', error);
    }
  }, []);

  // Load initial draft if provided
  useEffect(() => {
    if (initialDraftId) {
      loadDraft(initialDraftId);
    }
  }, [initialDraftId, loadDraft]);

  // ============================================================================
  // UPDATE TEMPLATE DATA
  // ============================================================================

  const updateTemplateData = useCallback((data: Partial<TemplateData>) => {
    setTemplateData(prev => {
      const updated = { ...prev, ...data };
      hasUnsavedChanges.current = true;
      return updated;
    });
  }, []);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic Info
        if (!templateData.template_id) {
          newErrors.template_id = 'Template ID is required';
        } else if (!/^[A-Z0-9_]+$/.test(templateData.template_id)) {
          newErrors.template_id = 'Template ID must contain only uppercase letters, numbers, and underscores';
        }
        
        if (!templateData.template_name) {
          newErrors.template_name = 'Template name is required';
        }
        
        if (!templateData.category) {
          newErrors.category = 'Category is required';
        }
        break;

      case 2: // Reference Images
        const imageCount = templateData.identification?.reference_images?.length || 0;
        if (imageCount === 0) {
          newErrors.reference_images = 'At least 1 reference image is required';
        }
        break;

      case 3: // Identification
        const patternCount = templateData.identification?.text_patterns?.length || 0;
        if (patternCount === 0) {
          newErrors.text_patterns = 'At least 1 text pattern is required';
        }
        break;

      case 4: // Region Configuration
        if (!templateData.region_config?.detection_method) {
          newErrors.detection_method = 'Detection method is required';
        }
        
        if (templateData.region_config?.detection_method === 'coordinates' && 
            !templateData.region_config?.coordinate_regions?.length) {
          newErrors.coordinate_regions = 'At least 1 coordinate region is required';
        }
        
        if (templateData.region_config?.detection_method === 'yolo' && 
            !templateData.region_config?.yolo_config) {
          newErrors.yolo_config = 'YOLO configuration is required';
        }
        break;

      case 5: // Prompts
        if (!templateData.prompts || Object.keys(templateData.prompts).length === 0) {
          newErrors.prompts = 'At least 1 region prompt is required';
        }
        break;

      case 6: // Field Mapping
        if (!templateData.field_mapping || Object.keys(templateData.field_mapping).length === 0) {
          newErrors.field_mapping = 'At least 1 field mapping is required';
        }
        break;

      case 7: // Review
        // All validations from previous steps
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [templateData]);

  // ============================================================================
  // SUBMIT TEMPLATE
  // ============================================================================

  const submitTemplate = useCallback(async (): Promise<string> => {
    try {
      // Validate all steps
      for (let step = 1; step <= 6; step++) {
        if (!validateStep(step)) {
          throw new Error(`Validation failed at step ${step}`);
        }
      }

      // First validate template structure
      const validateResponse = await fetch('/api/templates/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templateData),
      });

      if (!validateResponse.ok) {
        const error = await validateResponse.json();
        throw new Error(error.detail || 'Template validation failed');
      }

      // Create template
      const createResponse = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...templateData,
          status: 'inactive', // Start as inactive
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.detail || 'Failed to create template');
      }

      const result = await createResponse.json();

      // Delete draft after successful creation
      if (draftId) {
        await fetch(`/api/templates/draft?draft_id=${draftId}`, {
          method: 'DELETE',
        });
      }

      console.log('✅ Template created successfully:', result.template_id);
      return result.template_id;
    } catch (error) {
      console.error('❌ Failed to submit template:', error);
      throw error;
    }
  }, [templateData, draftId, validateStep]);

  // ============================================================================
  // RESET TEMPLATE
  // ============================================================================

  const resetTemplate = useCallback(() => {
    setTemplateData({
      version: '1.0.0',
      category: 'Stamp',
    });
    setCurrentStep(1);
    setDraftId(null);
    setErrors({});
    hasUnsavedChanges.current = false;
    setLastSaved(null);
  }, []);

  // ============================================================================
  // ERROR MANAGEMENT
  // ============================================================================

  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  // ============================================================================
  // CONTEXT VALUE
  // ============================================================================

  const value: TemplateContextType = {
    currentStep,
    totalSteps,
    templateData,
    draftId,
    isSaving,
    lastSaved,
    errors,
    setCurrentStep,
    updateTemplateData,
    saveDraft,
    loadDraft,
    validateStep,
    submitTemplate,
    resetTemplate,
    setError,
    clearError,
  };

  return (
    <TemplateContext.Provider value={value}>
      {children}
    </TemplateContext.Provider>
  );
};