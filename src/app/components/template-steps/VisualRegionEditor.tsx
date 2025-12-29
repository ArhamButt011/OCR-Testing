import React, { useState, useRef, useEffect } from 'react';
import { FaInfo, FaTrash, FaUndo, FaRedo, FaSyncAlt } from 'react-icons/fa';

interface CoordinateRegion {
  region_name: string;
  x1_ratio: number;
  y1_ratio: number;
  x2_ratio: number;
  y2_ratio: number;
  confidence_threshold?: number;
  image_id?: string;
  rotation?: number; // Rotation angle in degrees for the region
}

interface ReferenceImage {
  image_id: string;
  file_path: string;
  preview?: string;
  original_name?: string;
}

interface VisualRegionEditorProps {
  referenceImages: ReferenceImage[];
  regions: CoordinateRegion[];
  onRegionsChange: (regions: CoordinateRegion[]) => void;
  detectionMethod: 'yolo' | 'coordinates' | 'hybrid';
}

// Define a vibrant color palette for regions - expanded to 20 unique colors
const REGION_COLORS = [
  { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.15)', label: '#dc2626' },
  { stroke: '#8b5cf6', fill: 'rgba(139, 92, 246, 0.15)', label: '#7c3aed' },
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)', label: '#059669' },
  { stroke: '#f59e0b', fill: 'rgba(245, 158, 11, 0.15)', label: '#d97706' },
  { stroke: '#3b82f6', fill: 'rgba(59, 130, 246, 0.15)', label: '#2563eb' },
  { stroke: '#ec4899', fill: 'rgba(236, 72, 153, 0.15)', label: '#db2777' },
  { stroke: '#14b8a6', fill: 'rgba(20, 184, 166, 0.15)', label: '#0d9488' },
  { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.15)', label: '#ea580c' },
  { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.15)', label: '#4f46e5' },
  { stroke: '#84cc16', fill: 'rgba(132, 204, 22, 0.15)', label: '#65a30d' },
  { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.15)', label: '#0891b2' },
  { stroke: '#d946ef', fill: 'rgba(217, 70, 239, 0.15)', label: '#c026d3' },
  { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.15)', label: '#16a34a' },
  { stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.15)', label: '#ca8a04' },
  { stroke: '#0ea5e9', fill: 'rgba(14, 165, 233, 0.15)', label: '#0284c7' },
  { stroke: '#f43f5e', fill: 'rgba(244, 63, 94, 0.15)', label: '#e11d48' },
  { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.15)', label: '#9333ea' },
  { stroke: '#10b981', fill: 'rgba(16, 185, 129, 0.15)', label: '#059669' },
  { stroke: '#fb923c', fill: 'rgba(251, 146, 60, 0.15)', label: '#f97316' },
  { stroke: '#2dd4bf', fill: 'rgba(45, 212, 191, 0.15)', label: '#14b8a6' },
];

export const VisualRegionEditor: React.FC<VisualRegionEditorProps> = ({
  referenceImages,
  regions,
  onRegionsChange,
  detectionMethod,
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [currentImage, setCurrentImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentRegion, setCurrentRegion] = useState<CoordinateRegion | null>(null);
  const [dragState, setDragState] = useState<any>(null);
  const [hoveredRegionIndex, setHoveredRegionIndex] = useState<number | null>(null);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState<number | null>(null);
  const [isRotatingRegion, setIsRotatingRegion] = useState(false);
  const [rotation, setRotation] = useState(0); // Current rotation angle
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [rotationHistory, setRotationHistory] = useState<number[]>([0]); // For undo/redo
  const [historyIndex, setHistoryIndex] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);

  const currentImageId = referenceImages[selectedImageIndex]?.image_id;
  const currentImageRegions = regions.filter(r => r.image_id === currentImageId);

  // Helper function to get color for a region
  const getRegionColor = (globalIndex: number) => {
    const colorIndex = globalIndex % REGION_COLORS.length;
    return REGION_COLORS[colorIndex];
  };

  // Detect image rotation using edge detection
  const detectImageRotation = async (img: HTMLImageElement): Promise<number> => {
    return new Promise((resolve) => {
      const tempCanvas = document.createElement('canvas');
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        resolve(0);
        return;
      }

      // Scale down for faster processing
      const scale = Math.min(1, 800 / Math.max(img.width, img.height));
      tempCanvas.width = img.width * scale;
      tempCanvas.height = img.height * scale;
      
      ctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      
      const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const data = imageData.data;
      
      // Convert to grayscale and detect edges
      const gray: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        gray.push(avg);
      }
      
      // Detect dominant angles using Hough transform (simplified)
      const angles: { [key: number]: number } = {};
      const width = tempCanvas.width;
      const height = tempCanvas.height;
      
      // Sample edges
      for (let y = 1; y < height - 1; y += 2) {
        for (let x = 1; x < width - 1; x += 2) {
          const idx = y * width + x;
          const gx = gray[idx + 1] - gray[idx - 1];
          const gy = gray[idx + width] - gray[idx - width];
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          
          if (magnitude > 30) { // Edge threshold
            let angle = Math.atan2(gy, gx) * 180 / Math.PI;
            angle = Math.round(angle / 5) * 5; // Bin by 5 degrees
            angles[angle] = (angles[angle] || 0) + magnitude;
          }
        }
      }
      
      // Find dominant angle close to horizontal/vertical
      let maxScore = 0;
      let detectedAngle = 0;
      
      for (const angleStr in angles) {
        const angle = parseInt(angleStr);
        const score = angles[angle];
        
        // Look for angles near 0, 90, -90, 180 (document edges)
        const normalizedAngle = ((angle + 180) % 180) - 90;
        if (Math.abs(normalizedAngle) < 45 && score > maxScore) {
          maxScore = score;
          detectedAngle = normalizedAngle;
        }
      }
      
      // If detected angle is significant (> 3 degrees), suggest correction
      if (Math.abs(detectedAngle) > 3) {
        resolve(-detectedAngle); // Negative to correct the tilt
      } else {
        resolve(0);
      }
    });
  };

  // Load and potentially auto-rotate image
  useEffect(() => {
    if (referenceImages.length > 0 && selectedImageIndex < referenceImages.length) {
      const imgData = referenceImages[selectedImageIndex];
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      if (imgData.file_path) {
        img.src = imgData.file_path;
      }
      
      img.onload = async () => {
        originalImageRef.current = img;
        
        // Auto-detect rotation
        setIsAutoRotating(true);
        const detectedRotation = await detectImageRotation(img);
        setIsAutoRotating(false);
        
        if (Math.abs(detectedRotation) > 3) {
          console.log(`Detected rotation: ${detectedRotation.toFixed(2)}°`);
          setRotation(detectedRotation);
          setRotationHistory([detectedRotation]);
          setHistoryIndex(0);
        } else {
          setRotation(0);
          setRotationHistory([0]);
          setHistoryIndex(0);
        }
        
        setCurrentImage(img);
        
        if (canvasRef.current && containerRef.current) {
          const container = containerRef.current;
          const maxWidth = container.clientWidth;
          const maxHeight = 600;
          
          const scale = Math.min(
            maxWidth / img.width,
            maxHeight / img.height
          );
          
          canvasRef.current.width = img.width * scale;
          canvasRef.current.height = img.height * scale;
        }
      };
      
      img.onerror = () => {
        console.error('Failed to load image:', imgData.file_path);
      };
    }
  }, [selectedImageIndex, referenceImages]);

  // Redraw when rotation changes
  useEffect(() => {
    if (currentImage && canvasRef.current) {
      drawCanvas();
    }
  }, [currentImage, currentImageRegions, currentRegion, hoveredRegionIndex, regions, rotation]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (currentImage) {
      // Apply rotation
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(
        currentImage,
        -canvas.width / 2,
        -canvas.height / 2,
        canvas.width,
        canvas.height
      );
      ctx.restore();
    }
    
    // Draw existing regions
    currentImageRegions.forEach((region) => {
      const globalIndex = regions.findIndex(r => 
        r.image_id === region.image_id && 
        r.region_name === region.region_name &&
        r.x1_ratio === region.x1_ratio &&
        r.y1_ratio === region.y1_ratio
      );
      const isHovered = globalIndex === hoveredRegionIndex;
      drawRegion(ctx, region, globalIndex, false, isHovered);
    });
    
    // Draw current region being drawn
    if (currentRegion) {
      const nextColorIndex = regions.length;
      drawRegion(ctx, currentRegion, nextColorIndex, true, false);
    }
  };

  const drawRegion = (
    ctx: CanvasRenderingContext2D, 
    region: CoordinateRegion, 
    globalIndex: number, 
    isCurrent: boolean,
    isHovered: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const centerX = (region.x1_ratio + region.x2_ratio) / 2 * canvas.width;
    const centerY = (region.y1_ratio + region.y2_ratio) / 2 * canvas.height;
    const width = (region.x2_ratio - region.x1_ratio) * canvas.width;
    const height = (region.y2_ratio - region.y1_ratio) * canvas.height;
    
    const colors = getRegionColor(globalIndex);
    const isSelected = globalIndex === selectedRegionIndex;
    const regionRotation = region.rotation || 0;
    
    // Draw rectangle with image rotation and region rotation applied
    ctx.save();
    
    // Apply image rotation
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
    
    // Apply region rotation around region center
    ctx.translate(centerX, centerY);
    ctx.rotate((regionRotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
    
    const x = centerX - width / 2;
    const y = centerY - height / 2;
    
    ctx.strokeStyle = isSelected ? '#000000' : colors.stroke;
    ctx.lineWidth = isSelected ? 4 : (isHovered ? 3 : 2);
    ctx.strokeRect(x, y, width, height);
    
    ctx.fillStyle = colors.fill;
    ctx.fillRect(x, y, width, height);
    
    // Draw label
    const labelText = region.region_name || `region_${globalIndex + 1}`;
    ctx.font = 'bold 14px Arial';
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = 20;
    
    ctx.fillStyle = isSelected ? '#000000' : (isHovered ? '#000000' : colors.label);
    ctx.fillRect(x, y - textHeight - 5, textWidth + 10, textHeight);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, x + 5, y - 10);
    
    // Draw rotation angle badge if region is rotated
    if (regionRotation !== 0) {
      const rotBadgeText = `${regionRotation.toFixed(1)}°`;
      ctx.font = 'bold 11px Arial';
      const rotTextWidth = ctx.measureText(rotBadgeText).width;
      
      ctx.fillStyle = '#9333ea';
      ctx.fillRect(x + width - rotTextWidth - 10, y - textHeight - 5, rotTextWidth + 10, textHeight);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillText(rotBadgeText, x + width - rotTextWidth - 5, y - 10);
    }
    
    // Draw resize handles
    if (!isCurrent) {
      const handleSize = 8;
      ctx.fillStyle = isSelected ? '#000000' : (isHovered ? '#000000' : colors.stroke);
      
      // Corner handles
      ctx.fillRect(x - handleSize/2, y - handleSize/2, handleSize, handleSize);
      ctx.fillRect(x + width - handleSize/2, y - handleSize/2, handleSize, handleSize);
      ctx.fillRect(x - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
      ctx.fillRect(x + width - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
      
      // Side handles
      ctx.fillRect(x + width/2 - handleSize/2, y - handleSize/2, handleSize, handleSize);
      ctx.fillRect(x + width/2 - handleSize/2, y + height - handleSize/2, handleSize, handleSize);
      ctx.fillRect(x - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
      ctx.fillRect(x + width - handleSize/2, y + height/2 - handleSize/2, handleSize, handleSize);
      
      // Draw rotation handle for selected region
      if (isSelected) {
        const rotHandleDistance = 40;
        const rotHandleX = x + width / 2;
        const rotHandleY = y - rotHandleDistance;
        
        // Draw line to rotation handle
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(rotHandleX, rotHandleY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw rotation handle circle
        ctx.fillStyle = '#9333ea';
        ctx.beginPath();
        ctx.arc(rotHandleX, rotHandleY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw rotation icon in handle
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px Arial';
        ctx.fillText('↻', rotHandleX - 4, rotHandleY + 4);
      }
    }
    
    ctx.restore();
    
    // Draw dimensions
    if (isHovered && !isCurrent) {
      ctx.fillStyle = '#374151';
      ctx.font = '11px monospace';
      const dimText = `${width.toFixed(0)}×${height.toFixed(0)}px`;
      const x = (region.x1_ratio + region.x2_ratio) / 2 * canvas.width;
      const y = region.y2_ratio * canvas.height;
      ctx.fillText(dimText, x - 20, y + 15);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>, region?: CoordinateRegion) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let x = ((e.clientX - rect.left) * scaleX) / canvas.width;
    let y = ((e.clientY - rect.top) * scaleY) / canvas.height;
    
    // Apply inverse image rotation
    if (rotation !== 0) {
      const centerX = 0.5;
      const centerY = 0.5;
      const rad = (-rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const dx = x - centerX;
      const dy = y - centerY;
      
      x = centerX + dx * cos - dy * sin;
      y = centerY + dx * sin + dy * cos;
    }
    
    // Apply inverse region rotation if region is provided
    if (region && region.rotation) {
      const regionCenterX = (region.x1_ratio + region.x2_ratio) / 2;
      const regionCenterY = (region.y1_ratio + region.y2_ratio) / 2;
      const rad = (-region.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      const dx = x - regionCenterX;
      const dy = y - regionCenterY;
      
      x = regionCenterX + dx * cos - dy * sin;
      y = regionCenterY + dx * sin + dy * cos;
    }
    
    return { 
      x: Math.max(0, Math.min(1, x)), 
      y: Math.max(0, Math.min(1, y)) 
    };
  };

  const getHandleAtPosition = (x: number, y: number, region: CoordinateRegion) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    
    const handleSize = 8 / canvas.width;
    const tolerance = handleSize * 2;
    
    const regionCenterX = (region.x1_ratio + region.x2_ratio) / 2;
    const regionCenterY = (region.y1_ratio + region.y2_ratio) / 2;
    
    // Check rotation handle (above the region)
    const rotHandleDistance = 40 / canvas.height;
    const rotHandleY = region.y1_ratio - rotHandleDistance;
    if (Math.abs(x - regionCenterX) < tolerance && Math.abs(y - rotHandleY) < tolerance) {
      return 'rotate';
    }
    
    // For corner and edge handles, need to check in rotated space
    if (Math.abs(x - region.x1_ratio) < tolerance && Math.abs(y - region.y1_ratio) < tolerance) return 'tl';
    if (Math.abs(x - region.x2_ratio) < tolerance && Math.abs(y - region.y1_ratio) < tolerance) return 'tr';
    if (Math.abs(x - region.x1_ratio) < tolerance && Math.abs(y - region.y2_ratio) < tolerance) return 'bl';
    if (Math.abs(x - region.x2_ratio) < tolerance && Math.abs(y - region.y2_ratio) < tolerance) return 'br';
    
    const midX = (region.x1_ratio + region.x2_ratio) / 2;
    const midY = (region.y1_ratio + region.y2_ratio) / 2;
    
    if (Math.abs(x - midX) < tolerance && Math.abs(y - region.y1_ratio) < tolerance) return 't';
    if (Math.abs(x - midX) < tolerance && Math.abs(y - region.y2_ratio) < tolerance) return 'b';
    if (Math.abs(x - region.x1_ratio) < tolerance && Math.abs(y - midY) < tolerance) return 'l';
    if (Math.abs(x - region.x2_ratio) < tolerance && Math.abs(y - midY) < tolerance) return 'r';
    
    if (x >= region.x1_ratio && x <= region.x2_ratio && y >= region.y1_ratio && y <= region.y2_ratio) {
      return 'move';
    }
    
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const tempCoords = getCanvasCoordinates(e);
    
    // Check for rotation or resize handles on existing regions
    for (let i = currentImageRegions.length - 1; i >= 0; i--) {
      const region = currentImageRegions[i];
      const { x, y } = getCanvasCoordinates(e, region);
      const handle = getHandleAtPosition(x, y, region);
      
      if (handle) {
        const globalIndex = regions.findIndex(r => 
          r.image_id === region.image_id && 
          r.region_name === region.region_name &&
          r.x1_ratio === region.x1_ratio &&
          r.y1_ratio === region.y1_ratio
        );
        
        setSelectedRegionIndex(globalIndex);
        
        if (handle === 'rotate') {
          setIsRotatingRegion(true);
          setDragState({ 
            regionIndex: globalIndex, 
            handle: 'rotate',
            startX: x, 
            startY: y, 
            originalRegion: { ...regions[globalIndex] },
            centerX: (region.x1_ratio + region.x2_ratio) / 2,
            centerY: (region.y1_ratio + region.y2_ratio) / 2
          });
        } else {
          setDragState({ 
            regionIndex: globalIndex, 
            handle, 
            startX: x, 
            startY: y, 
            originalRegion: { ...regions[globalIndex] } 
          });
        }
        return;
      }
    }
    
    // No handle clicked, start drawing new region
    setSelectedRegionIndex(null);
    setIsDrawing(true);
    setCurrentRegion({ 
      region_name: '', 
      x1_ratio: tempCoords.x, 
      y1_ratio: tempCoords.y, 
      x2_ratio: tempCoords.x, 
      y2_ratio: tempCoords.y,
      confidence_threshold: undefined,
      image_id: currentImageId,
      rotation: 0
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const tempCoords = getCanvasCoordinates(e);
    
    if (!isDrawing && !dragState) {
      let foundHover = false;
      for (let i = currentImageRegions.length - 1; i >= 0; i--) {
        const region = currentImageRegions[i];
        const { x, y } = getCanvasCoordinates(e, region);
        const handle = getHandleAtPosition(x, y, region);
        
        if (handle) {
          foundHover = true;
          const globalIndex = regions.findIndex(r => 
            r.image_id === region.image_id && 
            r.region_name === region.region_name &&
            r.x1_ratio === region.x1_ratio &&
            r.y1_ratio === region.y1_ratio
          );
          setHoveredRegionIndex(globalIndex);
          
          const canvas = canvasRef.current;
          if (canvas) {
            if (handle === 'rotate') canvas.style.cursor = 'grab';
            else if (handle === 'move') canvas.style.cursor = 'move';
            else if (handle === 'tl' || handle === 'br') canvas.style.cursor = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') canvas.style.cursor = 'nesw-resize';
            else if (handle === 't' || handle === 'b') canvas.style.cursor = 'ns-resize';
            else if (handle === 'l' || handle === 'r') canvas.style.cursor = 'ew-resize';
          }
          break;
        }
      }
      if (!foundHover) {
        setHoveredRegionIndex(null);
        if (canvasRef.current) canvasRef.current.style.cursor = 'crosshair';
      }
    }
    
    if (dragState) {
      const { regionIndex, handle, startX, startY, originalRegion } = dragState;
      
      if (handle === 'rotate') {
        // Calculate rotation based on mouse movement
        const region = regions[regionIndex];
        const { x, y } = getCanvasCoordinates(e, region);
        const centerX = dragState.centerX;
        const centerY = dragState.centerY;
        
        // Calculate angle from center to current mouse position
        const startAngle = Math.atan2(startY - centerY, startX - centerX);
        const currentAngle = Math.atan2(y - centerY, x - centerX);
        const angleDiff = (currentAngle - startAngle) * 180 / Math.PI;
        
        const newRotation = (originalRegion.rotation || 0) + angleDiff;
        
        const updatedRegions = [...regions];
        updatedRegions[regionIndex] = {
          ...updatedRegions[regionIndex],
          rotation: newRotation
        };
        onRegionsChange(updatedRegions);
        
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
      } else {
        // Existing resize/move logic
        const { x, y } = getCanvasCoordinates(e, originalRegion);
        const dx = x - startX;
        const dy = y - startY;
        
        let updatedRegion = { ...originalRegion };
        
        if (handle === 'move') {
          const width = originalRegion.x2_ratio - originalRegion.x1_ratio;
          const height = originalRegion.y2_ratio - originalRegion.y1_ratio;
          updatedRegion.x1_ratio = Math.max(0, Math.min(1 - width, originalRegion.x1_ratio + dx));
          updatedRegion.y1_ratio = Math.max(0, Math.min(1 - height, originalRegion.y1_ratio + dy));
          updatedRegion.x2_ratio = updatedRegion.x1_ratio + width;
          updatedRegion.y2_ratio = updatedRegion.y1_ratio + height;
        } else if (handle === 'tl') {
          updatedRegion.x1_ratio = Math.max(0, Math.min(x, originalRegion.x2_ratio - 0.02));
          updatedRegion.y1_ratio = Math.max(0, Math.min(y, originalRegion.y2_ratio - 0.02));
        } else if (handle === 'tr') {
          updatedRegion.x2_ratio = Math.min(1, Math.max(x, originalRegion.x1_ratio + 0.02));
          updatedRegion.y1_ratio = Math.max(0, Math.min(y, originalRegion.y2_ratio - 0.02));
        } else if (handle === 'bl') {
          updatedRegion.x1_ratio = Math.max(0, Math.min(x, originalRegion.x2_ratio - 0.02));
          updatedRegion.y2_ratio = Math.min(1, Math.max(y, originalRegion.y1_ratio + 0.02));
        } else if (handle === 'br') {
          updatedRegion.x2_ratio = Math.min(1, Math.max(x, originalRegion.x1_ratio + 0.02));
          updatedRegion.y2_ratio = Math.min(1, Math.max(y, originalRegion.y1_ratio + 0.02));
        } else if (handle === 't') {
          updatedRegion.y1_ratio = Math.max(0, Math.min(y, originalRegion.y2_ratio - 0.02));
        } else if (handle === 'b') {
          updatedRegion.y2_ratio = Math.min(1, Math.max(y, originalRegion.y1_ratio + 0.02));
        } else if (handle === 'l') {
          updatedRegion.x1_ratio = Math.max(0, Math.min(x, originalRegion.x2_ratio - 0.02));
        } else if (handle === 'r') {
          updatedRegion.x2_ratio = Math.min(1, Math.max(x, originalRegion.x1_ratio + 0.02));
        }
        
        const updatedRegions = [...regions];
        updatedRegions[regionIndex] = updatedRegion;
        onRegionsChange(updatedRegions);
      }
    } else if (isDrawing && currentRegion) {
      setCurrentRegion({ ...currentRegion, x2_ratio: tempCoords.x, y2_ratio: tempCoords.y });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing && currentRegion) {
      const region = {
        ...currentRegion,
        x1_ratio: Math.min(currentRegion.x1_ratio, currentRegion.x2_ratio),
        y1_ratio: Math.min(currentRegion.y1_ratio, currentRegion.y2_ratio),
        x2_ratio: Math.max(currentRegion.x1_ratio, currentRegion.x2_ratio),
        y2_ratio: Math.max(currentRegion.y1_ratio, currentRegion.y2_ratio),
        region_name: `region_${currentImageRegions.length + 1}`,
        image_id: currentImageId,
        rotation: 0
      };
      
      if ((region.x2_ratio - region.x1_ratio) > 0.02 && (region.y2_ratio - region.y1_ratio) > 0.02) {
        onRegionsChange([...regions, region]);
      }
      
      setCurrentRegion(null);
      setIsDrawing(false);
    }
    
    if (dragState) {
      setIsRotatingRegion(false);
      setDragState(null);
    }
  };

  const handleDeleteRegion = (globalIndex: number) => {
    const updatedRegions = regions.filter((_, i) => i !== globalIndex);
    onRegionsChange(updatedRegions);
  };

  const handleImageChange = (index: number) => {
    setSelectedImageIndex(index);
    setIsDrawing(false);
    setCurrentRegion(null);
    setDragState(null);
    setHoveredRegionIndex(null);
  };

  // Rotation control functions
  const rotateImage = (angle: number) => {
    const newRotation = (rotation + angle) % 360;
    setRotation(newRotation);
    
    // Update history
    const newHistory = rotationHistory.slice(0, historyIndex + 1);
    newHistory.push(newRotation);
    setRotationHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undoRotation = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setRotation(rotationHistory[historyIndex - 1]);
    }
  };

  const redoRotation = () => {
    if (historyIndex < rotationHistory.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setRotation(rotationHistory[historyIndex + 1]);
    }
  };

  const resetRotation = () => {
    setRotation(0);
    setRotationHistory([0]);
    setHistoryIndex(0);
  };

  if (referenceImages.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <FaInfo className="w-12 h-12 mx-auto text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Reference Images</h3>
        <p className="text-sm text-gray-600">
          Please upload reference images in Step 2 before configuring regions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Visual Region Editor</h3>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FaInfo className="w-4 h-4" />
          <span>Draw regions by clicking and dragging on the image</span>
        </div>
      </div>

      {/* Image Rotation Controls */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FaSyncAlt className={`w-4 h-4 text-purple-600 ${isAutoRotating ? 'animate-spin' : ''}`} />
            <h4 className="text-sm font-semibold text-gray-900">Image Rotation Controls</h4>
            {isAutoRotating && (
              <span className="text-xs text-purple-600 animate-pulse">Detecting rotation...</span>
            )}
          </div>
          <div className="text-sm font-mono text-gray-700 bg-white px-3 py-1 rounded-md border border-purple-200">
            {rotation.toFixed(1)}°
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Rotation Buttons */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-purple-200">
            <button
              onClick={() => rotateImage(-90)}
              className="p-2 hover:bg-purple-100 rounded-md transition-colors"
              title="Rotate 90° counter-clockwise"
            >
              <FaUndo className="w-4 h-4 text-purple-600" />
            </button>
            <button
              onClick={() => rotateImage(-1)}
              className="px-3 py-2 hover:bg-purple-100 rounded-md transition-colors text-sm font-medium text-purple-700"
              title="Rotate 1° counter-clockwise"
            >
              -1°
            </button>
            <button
              onClick={() => rotateImage(-0.1)}
              className="px-3 py-2 hover:bg-purple-100 rounded-md transition-colors text-xs font-medium text-purple-600"
              title="Rotate 0.1° counter-clockwise"
            >
              -0.1°
            </button>
            <div className="w-px h-6 bg-purple-200" />
            <button
              onClick={() => rotateImage(0.1)}
              className="px-3 py-2 hover:bg-purple-100 rounded-md transition-colors text-xs font-medium text-purple-600"
              title="Rotate 0.1° clockwise"
            >
              +0.1°
            </button>
            <button
              onClick={() => rotateImage(1)}
              className="px-3 py-2 hover:bg-purple-100 rounded-md transition-colors text-sm font-medium text-purple-700"
              title="Rotate 1° clockwise"
            >
              +1°
            </button>
            <button
              onClick={() => rotateImage(90)}
              className="p-2 hover:bg-purple-100 rounded-md transition-colors"
              title="Rotate 90° clockwise"
            >
              <FaRedo className="w-4 h-4 text-purple-600" />
            </button>
          </div>

          {/* History Controls */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-purple-200">
            <button
              onClick={undoRotation}
              disabled={historyIndex === 0}
              className="p-2 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Undo rotation"
            >
              <FaUndo className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={redoRotation}
              disabled={historyIndex === rotationHistory.length - 1}
              className="p-2 hover:bg-purple-100 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Redo rotation"
            >
              <FaRedo className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Reset Button */}
          <button
            onClick={resetRotation}
            className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
            title="Reset rotation to 0°"
          >
            Reset
          </button>

          {/* Auto-detect Info */}
          {Math.abs(rotation) > 3 && (
            <div className="flex items-center gap-2 text-xs text-purple-700 bg-purple-100 px-3 py-1.5 rounded-md">
              <FaInfo className="w-3 h-3" />
              <span>Auto-detected tilt corrected</span>
            </div>
          )}
        </div>
      </div>

      {referenceImages.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Reference Image ({currentImageRegions.length} regions on this image)
          </label>
          <div className="flex gap-2 flex-wrap">
            {referenceImages.map((img, index) => {
              const imageRegionCount = regions.filter(r => r.image_id === img.image_id).length;
              return (
                <button
                  key={img.image_id}
                  onClick={() => handleImageChange(index)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
                    selectedImageIndex === index
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Image {index + 1}
                  {imageRegionCount > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${
                      selectedImageIndex === index
                        ? 'bg-orange-800'
                        : 'bg-gray-200 text-gray-700'
                    }`}>
                      {imageRegionCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="border-2 border-orange-200 rounded-lg p-4 bg-gradient-to-br from-orange-50 to-white">
        <div className="bg-white rounded-lg shadow-inner overflow-hidden" ref={containerRef}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full"
            style={{ cursor: 'crosshair' }}
          />
        </div>

        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start gap-2">
            <FaInfo className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How to use:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Use rotation controls above to straighten tilted images</li>
                <li>Click and drag to draw new regions (each gets a unique color)</li>
                <li>Click a region to select it and see rotation controls</li>
                <li>Drag the purple circular handle above a selected region to rotate it</li>
                <li>Click inside a region to move it</li>
                <li>Drag corner/side handles to resize</li>
                <li>Each image has its own independent regions and rotation</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {currentImageRegions.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Regions on Image {selectedImageIndex + 1} ({currentImageRegions.length})
          </h4>
          <div className="space-y-2">
            {currentImageRegions.map((region, localIndex) => {
              const globalIndex = regions.findIndex(r => 
                r.image_id === region.image_id && 
                r.region_name === region.region_name &&
                r.x1_ratio === region.x1_ratio &&
                r.y1_ratio === region.y1_ratio
              );
              const colors = getRegionColor(globalIndex);
              const isSelected = globalIndex === selectedRegionIndex;
              
              return (
                <div
                  key={localIndex}
                  onMouseEnter={() => setHoveredRegionIndex(globalIndex)}
                  onMouseLeave={() => setHoveredRegionIndex(null)}
                  onClick={() => setSelectedRegionIndex(globalIndex)}
                  className={`rounded-md border-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-gray-900 bg-gray-100 shadow-md'
                      : hoveredRegionIndex === globalIndex
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                  style={{
                    borderLeftWidth: '6px',
                    borderLeftColor: colors.stroke
                  }}
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 flex-1">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: colors.stroke }}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{region.region_name}</p>
                        <p className="text-xs text-gray-600 font-mono">
                          x1: {region.x1_ratio.toFixed(3)}, y1: {region.y1_ratio.toFixed(3)}, 
                          x2: {region.x2_ratio.toFixed(3)}, y2: {region.y2_ratio.toFixed(3)}
                          {region.rotation !== undefined && region.rotation !== 0 && (
                            <span className="ml-2 text-purple-600 font-bold">
                              ↻ {region.rotation.toFixed(1)}°
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteRegion(globalIndex);
                      }}
                      className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Delete region"
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {/* Region Rotation Controls - Show when selected */}
                  {isSelected && (
                    <div className="px-3 pb-3 border-t border-gray-200 pt-3 bg-purple-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-700 flex items-center gap-2">
                          <FaSyncAlt className="w-3 h-3 text-purple-600" />
                          Region Rotation
                        </span>
                        <span className="text-xs font-mono text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200">
                          {(region.rotation || 0).toFixed(1)}°
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedRegions = [...regions];
                            updatedRegions[globalIndex] = {
                              ...updatedRegions[globalIndex],
                              rotation: ((updatedRegions[globalIndex].rotation || 0) - 5) % 360
                            };
                            onRegionsChange(updatedRegions);
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors text-xs font-medium"
                        >
                          -5°
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedRegions = [...regions];
                            updatedRegions[globalIndex] = {
                              ...updatedRegions[globalIndex],
                              rotation: ((updatedRegions[globalIndex].rotation || 0) - 1) % 360
                            };
                            onRegionsChange(updatedRegions);
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors text-xs font-medium"
                        >
                          -1°
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedRegions = [...regions];
                            updatedRegions[globalIndex] = {
                              ...updatedRegions[globalIndex],
                              rotation: 0
                            };
                            onRegionsChange(updatedRegions);
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors text-xs font-medium"
                          title="Reset to 0°"
                        >
                          Reset
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedRegions = [...regions];
                            updatedRegions[globalIndex] = {
                              ...updatedRegions[globalIndex],
                              rotation: ((updatedRegions[globalIndex].rotation || 0) + 1) % 360
                            };
                            onRegionsChange(updatedRegions);
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors text-xs font-medium"
                        >
                          +1°
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedRegions = [...regions];
                            updatedRegions[globalIndex] = {
                              ...updatedRegions[globalIndex],
                              rotation: ((updatedRegions[globalIndex].rotation || 0) + 5) % 360
                            };
                            onRegionsChange(updatedRegions);
                          }}
                          className="flex-1 px-2 py-1 bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-100 transition-colors text-xs font-medium"
                        >
                          +5°
                        </button>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                        <FaInfo className="w-3 h-3" />
                        <span>Drag the purple handle above the region to rotate visually</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};