"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

// ============================================================================
// TYPES
// ============================================================================

export interface ReferenceImage {
  image_id: string;
  file_path: string;
  file?: File;
  original_name?: string;
  mime_type?: string;
  size?: number;
  preview?: string;
}

export interface CoordinateRegion {
  region_name: string;
  x1_ratio: number;
  y1_ratio: number;
  x2_ratio: number;
  y2_ratio: number;
  confidence_threshold?: number;
}

export interface YoloClass {
  class_id: string;
  region_name: string;
  confidence_threshold?: number;
}

export interface YoloConfig {
  model_name: string;
  model_path: string;
  confidence_threshold: number;
  iou_threshold?: number;
  classes: YoloClass[];
}

export interface HybridConfig {
  primary_method: "yolo" | "coordinates";
  fallback_method: "yolo" | "coordinates";
}

export interface RegionConfig {
  detection_method: "yolo" | "coordinates" | "hybrid";
  coordinate_regions?: CoordinateRegion[];
  yolo_config?: YoloConfig;
  hybrid_config?: HybridConfig;
}

export interface RegionPrompt {
  prompt_text: string;
  expected_output_schema: Record<string, string>;
}

export interface FieldMapping {
  source_field: string;
  target_field: string;
  data_type: "string" | "integer" | "float" | "boolean" | "date";
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

// New Post-Processing Rule Types
export interface ValidationRule {
  rule_name: string;
  field: string | string[];
  condition: string;
  action: string;
  reason?: string;
}

export interface TransformationRule {
  rule_name: string;
  field: string;
  action: string;
  formats?: string[];
  pattern?: string;
  description?: string;
}

export interface BusinessLogicRule {
  rule_name: string;
  condition: string;
  action: string;
  target_field: string;
  value: string;
  reason?: string;
}

export interface PostProcessingRules {
  validation_rules?: ValidationRule[];
  transformation_rules?: TransformationRule[];
  business_logic?: BusinessLogicRule[];
}

export interface TemplateData {
  _id?: string;

  // Step 1: Basic Info
  template_id?: string;
  template_name?: string;
  category?: "Stamp" | "Notation" | "Receipt";
  version?: string;
  description?: string;
  identification?: {
    reference_images?: ReferenceImage[];
    text_patterns?: string[];
  };
  region_config?: RegionConfig;
  prompts?: Record<string, RegionPrompt>;
  field_mapping?: Record<string, FieldMapping>;
  post_processing_rules?: PostProcessingRules;
  status?: "active" | "inactive" | "deprecated";
}

interface TemplateContextType {
  currentStep: number;
  totalSteps: number;
  templateData: TemplateData;
    isLoadingTemplate: boolean;
  draftId: string | null;
  isSaving: boolean;
  lastSaved: Date | null;
  errors: Record<string, any>;
  isEditMode: boolean;
  originalDraftId: string | null;
  onModalClose?: (shouldRefresh?: boolean, templateData?: any) => void; // Updated signature
  setCurrentStep: (step: number) => void;
  updateTemplateData: (data: Partial<TemplateData>) => void;
  saveDraft: () => Promise<void>;
  loadDraft: (draftId: string) => Promise<void>;
  loadTemplate: (templateId: string) => Promise<void>;
  validateStep: (step: number) => boolean;
  submitTemplate: () => Promise<any>;
  resetTemplate: () => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  setErrors: (errors: Record<string, any>) => void;
}


// ============================================================================
// CONTEXT
// ============================================================================

const TemplateContext = createContext<TemplateContextType | undefined>(
  undefined
);

export const useTemplate = () => {
  const context = useContext(TemplateContext);
  if (!context) {
    throw new Error("useTemplate must be used within TemplateProvider");
  }
  return context;
};

// ============================================================================
// PROVIDER
// ============================================================================

interface TemplateProviderProps {
  children: React.ReactNode;
  initialDraftId?: string;
  initialTemplateId?: string;
  onModalClose?: (shouldRefresh?: boolean) => void;
}

export const TemplateProvider: React.FC<TemplateProviderProps> = ({
  children,
  initialDraftId,
  initialTemplateId,
  onModalClose,
}) => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 7;
  const [templateData, setTemplateData] = useState<TemplateData>({
    version: "1.0.0",
    category: "Stamp",
  });
  const [draftId, setDraftId] = useState<string | null>(initialDraftId || null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditMode, setIsEditMode] = useState(!!initialTemplateId);
  const [originalDraftId, setOriginalDraftId] = useState<string | null>(null);
    const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);

  const saveTimerRef = useRef<NodeJS.Timeout>();
  const hasUnsavedChanges = useRef(false);

  // ============================================================================
  // AUTO-SAVE WITH DEBOUNCING
  // ============================================================================
console.log('submitting template with template dtaa-> ', templateData)
  const saveDraft = useCallback(async () => {
    if (isEditMode) {
      console.log("Skipping draft save - in edit mode");
      hasUnsavedChanges.current = false;
      return;
    }

    if (!hasUnsavedChanges.current) return;

    setIsSaving(true);
    try {
      const { _id, ...draftData } = templateData;

      const requestBody = {
        step_number: currentStep,
        total_steps: totalSteps,
        partial_data: draftData,
      };

      let data;

      if (draftId) {
        const response = await axios.patch(
          `/api/templates/draft?draft_id=${draftId}`,
          requestBody
        );
        data = response.data;
      } else {
        const response = await axios.post("/api/templates/draft", requestBody);
        data = response.data;
      }

      console.log("✅ Draft save response:", data);

      if (!draftId && data._id) {
        setDraftId(data._id);
        console.log("New draft created with ID:", data._id);
      }

      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      console.log("Draft saved successfully");
    } catch (error) {
      console.error("Failed to save draft:", error);
    } finally {
      setIsSaving(false);
    }
  }, [draftId, currentStep, templateData, isEditMode]);

  useEffect(() => {
    if (hasUnsavedChanges.current) {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      saveTimerRef.current = setTimeout(() => {
        saveDraft();
      }, 2000);
    }

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [templateData, saveDraft]);

  const loadDraft = useCallback(async (id: string) => {
        setIsLoadingTemplate(true);

    try {
      const response = await axios.get(`/api/templates/draft?draft_id=${id}`);
      const data = response.data;

      console.log("Draft API response:", data);

      const draft = data.draft || data;

      console.log("Extracted draft:", draft);

      setOriginalDraftId(draft._id);
      console.log("📌 Stored originalDraftId:", draft._id);

      setDraftId(draft._id);

      const stepNumber = draft.step_number || draft.current_step || 1;
      setCurrentStep(stepNumber);

      const partialData = draft.partial_data || {};
      console.log("📝 Loading partial data into form:", partialData);
      setTemplateData(partialData);

      const lastSavedTime = draft.metadata?.last_saved_at || draft.updated_at;
      if (lastSavedTime) {
        setLastSaved(new Date(lastSavedTime));
      }

      setIsEditMode(false);

      console.log("Draft loaded successfully - form should be pre-filled now");
    } catch (error) {
      console.error("Failed to load draft:", error);
      throw error;
    }
    finally {
      setIsLoadingTemplate(false);
    }
  }, []);

  const loadTemplate = useCallback(async (templateId: string) => {
     setIsLoadingTemplate(true);
    try {
      const response = await axios.get(`/api/templates/${templateId}`);
      const data = response.data;
      const template = data.template || data;
      if (template.metadata) {
        delete template.metadata;
      }

      console.log("Final template data (with _id):", template);

      setTemplateData(template);
      setIsEditMode(true);
      setDraftId(null);
      setOriginalDraftId(null);
      setCurrentStep(1);
    } catch (error) {
      console.error("Failed to load template:", error);
      throw error;
    }
    finally {
      setIsLoadingTemplate(false);
    }
  }, []);

  useEffect(() => {
    if (initialDraftId) {
      loadDraft(initialDraftId);
    } else if (initialTemplateId) {
      loadTemplate(initialTemplateId);
    }
  }, [initialDraftId, initialTemplateId, loadDraft, loadTemplate]);

  // ============================================================================
  // UPDATE TEMPLATE DATA
  // ============================================================================

  const updateTemplateData = useCallback((data: Partial<TemplateData>) => {
    console.log("Updating template data with:", data);
    setTemplateData((prev) => {
      const updated = { ...prev, ...data };
      hasUnsavedChanges.current = true;
      return updated;
    });
  }, []);

  // ============================================================================
  // VALIDATION
  // ============================================================================

  const validateStep = useCallback(
    (step: number): boolean => {
      const newErrors: Record<string, string> = {};

      switch (step) {
        case 1:
          if (!templateData.template_id) {
            newErrors.template_id = "Template ID is required";
          } else if (!/^[A-Z0-9_]+$/.test(templateData.template_id)) {
            newErrors.template_id =
              "Template ID must contain only uppercase letters, numbers, and underscores";
          } else if (errors.template_id) {
            newErrors.template_id = errors.template_id;
          }

          if (!templateData.template_name) {
            newErrors.template_name = "Template name is required";
          }

          if (!templateData.category) {
            newErrors.category = "Category is required";
          }
          break;

        case 2:
          const imageCount =
            templateData.identification?.reference_images?.length || 0;
          if (imageCount === 0) {
            newErrors.reference_images =
              "At least 1 reference image is required";
          }
          break;

        case 3:
          const patternCount =
            templateData.identification?.text_patterns?.length || 0;
          if (patternCount === 0) {
            newErrors.text_patterns = "At least 1 text pattern is required";
          }
          break;

        case 4:
          if (!templateData.region_config?.detection_method) {
            newErrors.detection_method = "Detection method is required";
          }

          if (
            templateData.region_config?.detection_method === "coordinates" &&
            !templateData.region_config?.coordinate_regions?.length
          ) {
            newErrors.coordinate_regions =
              "At least 1 coordinate region is required";
          }

          if (
            templateData.region_config?.detection_method === "yolo" &&
            !templateData.region_config?.yolo_config
          ) {
            newErrors.yolo_config = "YOLO configuration is required";
          }
          break;

        case 5:
          if (
            !templateData.prompts ||
            Object.keys(templateData.prompts).length === 0
          ) {
            newErrors.prompts = "At least 1 region prompt is required";
          } else {
            const promptErrors: any = {};
            Object.entries(templateData.prompts).forEach(
              ([region, promptConfig]) => {
                if (
                  !promptConfig.prompt_text ||
                  promptConfig.prompt_text.trim() === ""
                ) {
                  promptErrors[region] = {
                    ...promptErrors[region],
                    prompt_text: "Prompt text is required",
                  };
                }

                if (
                  !promptConfig.expected_output_schema ||
                  Object.keys(promptConfig.expected_output_schema).length === 0
                ) {
                  promptErrors[region] = {
                    ...promptErrors[region],
                    schema: "Expected output schema is required",
                  };
                }
              }
            );

            if (Object.keys(promptErrors).length > 0) {
              newErrors.prompts = promptErrors;
            }

            if (errors.prompts && typeof errors.prompts === "object") {
              const hasSchemaErrors = Object.values(errors.prompts).some(
                (err: any) => err && err.schema
              );
              if (hasSchemaErrors) {
                newErrors.prompts = errors.prompts;
              }
            }
          }
          break;

        case 6:
          if (
            !templateData.field_mapping ||
            Object.keys(templateData.field_mapping).length === 0
          ) {
            newErrors.field_mapping = "At least 1 field mapping is required";
          }
          break;

        case 7:
          break;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [templateData, errors]
  );

  const submitTemplate = useCallback(async (): Promise<string> => {
    try {
      for (let step = 1; step <= 6; step++) {
        if (!validateStep(step)) {
          throw new Error(`Validation failed at step ${step}`);
        }
      }

      const { _id, ...templateBody } = templateData;

      if (templateBody.region_config) {
        const detectionMethod = templateBody.region_config.detection_method;

        if (detectionMethod === "yolo") {
          templateBody.region_config = {
            detection_method: "yolo",
            yolo_config: templateBody.region_config.yolo_config || {
              model_name: "",
              model_path: "",
              confidence_threshold: 0.6,
              iou_threshold: 0.45,
              classes: [],
            },
          };
        } else if (detectionMethod === "coordinates") {
          templateBody.region_config = {
            detection_method: "coordinates",
            coordinate_regions:
              templateBody.region_config.coordinate_regions || [],
          };
        } else if (detectionMethod === "hybrid") {
          const cleanedConfig: any = {
            detection_method: "hybrid",
            hybrid_config: templateBody.region_config.hybrid_config || {
              primary_method: "yolo",
              fallback_method: "coordinates",
            },
          };

          if (
            templateBody.region_config.yolo_config &&
            Array.isArray(templateBody.region_config.yolo_config.classes) &&
            templateBody.region_config.yolo_config.classes.length > 0
          ) {
            cleanedConfig.yolo_config = templateBody.region_config.yolo_config;
          }

          if (
            templateBody.region_config.coordinate_regions &&
            Array.isArray(templateBody.region_config.coordinate_regions) &&
            templateBody.region_config.coordinate_regions.length > 0
          ) {
            cleanedConfig.coordinate_regions =
              templateBody.region_config.coordinate_regions;
          }

          templateBody.region_config = cleanedConfig;
        }
      }

      try {
        await axios.post("/api/templates/validate", templateBody);
      } catch (error: any) {
        throw {
          error: error.response?.data?.error || "Template validation failed",
          details: error.response?.data?.details || [],
          status: error.response?.status,
        };
      }

      let result;

      if (isEditMode && _id) {
        try {
          const response = await axios.patch(
            `/api/templates/${_id}`,
            templateBody
          );
          result = response.data;
        } catch (error: any) {
          throw {
            error: error.response?.data?.error || "Failed to update template",
            details: error.response?.data?.details || [],
          };
        }
      } else {
        const createBody = {
          ...templateBody,
          status: "inactive",
          ...(originalDraftId && { draft_id: originalDraftId }),
        };

        try {
          const response = await axios.post("/api/templates", createBody);
          result = response.data;
        } catch (error: any) {
          throw {
            error: error.response?.data?.error || "Failed to create template",
            details: error.response?.data?.details || [],
          };
        }
      }

      setOriginalDraftId(null);

      return result;
    } catch (error) {
      console.error("Failed to submit template:", error);
      throw error;
    }
  }, [templateData, validateStep, isEditMode, originalDraftId]);

  // ============================================================================
  // RESET TEMPLATE
  // ============================================================================

  const resetTemplate = useCallback(() => {
    setTemplateData({
      version: "1.0.0",
      category: "Stamp",
    });
    setCurrentStep(1);
    setDraftId(null);
    setErrors({});
    setIsEditMode(false);
    setOriginalDraftId(null);
    hasUnsavedChanges.current = false;
    setLastSaved(null);
  }, []);

  // ============================================================================
  // ERROR MANAGEMENT
  // ============================================================================

  const setError = useCallback((field: string, error: string) => {
    setErrors((prev) => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
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
    isEditMode,
    isLoadingTemplate,
    originalDraftId,
    onModalClose,
    setCurrentStep,
    updateTemplateData,
    saveDraft,
    loadDraft,
    loadTemplate,
    validateStep,
    submitTemplate,
    resetTemplate,
    setError,
    clearError,
    setErrors,
  };

  return (
    <TemplateContext.Provider value={value}>
      {children}
    </TemplateContext.Provider>
  );
};