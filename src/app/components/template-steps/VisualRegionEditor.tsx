import React, { useState, useRef, useEffect } from 'react';
import { FaInfo, FaTrash } from 'react-icons/fa'

interface CoordinateRegion {
  region_name: string;
  x1_ratio: number;
  y1_ratio: number;
  x2_ratio: number;
  y2_ratio: number;
  confidence_threshold?: number;
  image_id?: string; // Track which image this region belongs to
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get current image ID
  const currentImageId = referenceImages[selectedImageIndex]?.image_id;

  // Filter regions for current image only
  const currentImageRegions = regions.filter(r => r.image_id === currentImageId);

  // Load reference image
  useEffect(() => {
    if (referenceImages.length > 0 && selectedImageIndex < referenceImages.length) {
      const imgData = referenceImages[selectedImageIndex];
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      // Use file_path from the template data
      if (imgData.file_path) {
        img.src = imgData.file_path;
      }
      
      img.onload = () => {
        setCurrentImage(img);
        // Resize canvas to fit container while maintaining aspect ratio
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

  // Draw canvas - only show regions for current image
  useEffect(() => {
    if (currentImage && canvasRef.current) {
      drawCanvas();
    }
  }, [currentImage, currentImageRegions, currentRegion, hoveredRegionIndex]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw image
    if (currentImage) {
      ctx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
    }
    
    // Draw existing regions for current image only
    currentImageRegions.forEach((region, index) => {
      const globalIndex = regions.findIndex(r => 
        r.image_id === region.image_id && 
        r.region_name === region.region_name &&
        r.x1_ratio === region.x1_ratio &&
        r.y1_ratio === region.y1_ratio
      );
      const isHovered = globalIndex === hoveredRegionIndex;
      drawRegion(ctx, region, index, false, isHovered);
    });
    
    // Draw current region being drawn
    if (currentRegion) {
      drawRegion(ctx, currentRegion, currentImageRegions.length, true, false);
    }
  };

  const drawRegion = (
    ctx: CanvasRenderingContext2D, 
    region: CoordinateRegion, 
    index: number, 
    isCurrent: boolean,
    isHovered: boolean
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const x = region.x1_ratio * canvas.width;
    const y = region.y1_ratio * canvas.height;
    const width = (region.x2_ratio - region.x1_ratio) * canvas.width;
    const height = (region.y2_ratio - region.y1_ratio) * canvas.height;
    
    // Draw rectangle
    ctx.strokeStyle = isCurrent ? '#3b82f6' : (isHovered ? '#f59e0b' : '#10b981');
    ctx.lineWidth = isHovered ? 3 : 2;
    ctx.strokeRect(x, y, width, height);
    
    // Draw semi-transparent fill
    ctx.fillStyle = isCurrent 
      ? 'rgba(59, 130, 246, 0.15)' 
      : (isHovered ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.1)');
    ctx.fillRect(x, y, width, height);
    
    // Draw label with background
    const labelText = region.region_name || `region_${index + 1}`;
    ctx.font = 'bold 14px Arial';
    const textMetrics = ctx.measureText(labelText);
    const textWidth = textMetrics.width;
    const textHeight = 20;
    
    // Label background
    ctx.fillStyle = isCurrent ? '#3b82f6' : (isHovered ? '#f59e0b' : '#10b981');
    ctx.fillRect(x, y - textHeight - 5, textWidth + 10, textHeight);
    
    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, x + 5, y - 10);
    
    // Draw resize handles (only for existing regions, not while drawing)
    if (!isCurrent) {
      const handleSize = 8;
      ctx.fillStyle = isHovered ? '#f59e0b' : '#10b981';
      
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
    }
    
    // Draw dimensions
    if (isHovered && !isCurrent) {
      ctx.fillStyle = '#374151';
      ctx.font = '11px monospace';
      const dimText = `${width.toFixed(0)}×${height.toFixed(0)}px`;
      ctx.fillText(dimText, x, y + height + 15);
    }
  };

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = ((e.clientX - rect.left) * scaleX) / canvas.width;
    const y = ((e.clientY - rect.top) * scaleY) / canvas.height;
    
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
    
    // Corner handles
    if (Math.abs(x - region.x1_ratio) < tolerance && Math.abs(y - region.y1_ratio) < tolerance) return 'tl';
    if (Math.abs(x - region.x2_ratio) < tolerance && Math.abs(y - region.y1_ratio) < tolerance) return 'tr';
    if (Math.abs(x - region.x1_ratio) < tolerance && Math.abs(y - region.y2_ratio) < tolerance) return 'bl';
    if (Math.abs(x - region.x2_ratio) < tolerance && Math.abs(y - region.y2_ratio) < tolerance) return 'br';
    
    // Side handles
    const midX = (region.x1_ratio + region.x2_ratio) / 2;
    const midY = (region.y1_ratio + region.y2_ratio) / 2;
    
    if (Math.abs(x - midX) < tolerance && Math.abs(y - region.y1_ratio) < tolerance) return 't';
    if (Math.abs(x - midX) < tolerance && Math.abs(y - region.y2_ratio) < tolerance) return 'b';
    if (Math.abs(x - region.x1_ratio) < tolerance && Math.abs(y - midY) < tolerance) return 'l';
    if (Math.abs(x - region.x2_ratio) < tolerance && Math.abs(y - midY) < tolerance) return 'r';
    
    // Check if inside region for move
    if (x >= region.x1_ratio && x <= region.x2_ratio && y >= region.y1_ratio && y <= region.y2_ratio) {
      return 'move';
    }
    
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);
    
    // Check if clicking on existing region (only current image regions)
    for (let i = currentImageRegions.length - 1; i >= 0; i--) {
      const handle = getHandleAtPosition(x, y, currentImageRegions[i]);
      if (handle) {
        // Find global index
        const globalIndex = regions.findIndex(r => 
          r.image_id === currentImageRegions[i].image_id && 
          r.region_name === currentImageRegions[i].region_name &&
          r.x1_ratio === currentImageRegions[i].x1_ratio &&
          r.y1_ratio === currentImageRegions[i].y1_ratio
        );
        
        setDragState({ 
          regionIndex: globalIndex, 
          handle, 
          startX: x, 
          startY: y, 
          originalRegion: { ...regions[globalIndex] } 
        });
        return;
      }
    }
    
    // Start drawing new region
    setIsDrawing(true);
    setCurrentRegion({ 
      region_name: '', 
      x1_ratio: x, 
      y1_ratio: y, 
      x2_ratio: x, 
      y2_ratio: y,
      confidence_threshold: undefined,
      image_id: currentImageId // Associate with current image
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);
    
    // Update cursor and hover state
    if (!isDrawing && !dragState) {
      let foundHover = false;
      for (let i = currentImageRegions.length - 1; i >= 0; i--) {
        const handle = getHandleAtPosition(x, y, currentImageRegions[i]);
        if (handle) {
          foundHover = true;
          // Find global index
          const globalIndex = regions.findIndex(r => 
            r.image_id === currentImageRegions[i].image_id && 
            r.region_name === currentImageRegions[i].region_name &&
            r.x1_ratio === currentImageRegions[i].x1_ratio &&
            r.y1_ratio === currentImageRegions[i].y1_ratio
          );
          setHoveredRegionIndex(globalIndex);
          
          // Set cursor based on handle type
          const canvas = canvasRef.current;
          if (canvas) {
            if (handle === 'move') canvas.style.cursor = 'move';
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
    } else if (isDrawing && currentRegion) {
      setCurrentRegion({ ...currentRegion, x2_ratio: x, y2_ratio: y });
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
        image_id: currentImageId // Ensure image_id is set
      };
      
      // Only add if region has minimum size
      if ((region.x2_ratio - region.x1_ratio) > 0.02 && (region.y2_ratio - region.y1_ratio) > 0.02) {
        onRegionsChange([...regions, region]);
      }
      
      setCurrentRegion(null);
      setIsDrawing(false);
    }
    
    if (dragState) {
      setDragState(null);
    }
  };

  const handleDeleteRegion = (globalIndex: number) => {
    const updatedRegions = regions.filter((_, i) => i !== globalIndex);
    onRegionsChange(updatedRegions);
  };

  const handleImageChange = (index: number) => {
    setSelectedImageIndex(index);
    // Reset drawing state when changing images
    setIsDrawing(false);
    setCurrentRegion(null);
    setDragState(null);
    setHoveredRegionIndex(null);
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

      {/* Image Selector */}
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
                      ? 'bg-orange-600 text-white shadow-sm'
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

      {/* Canvas Container */}
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

        {/* Instructions */}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-start gap-2">
            <FaInfo className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">How to use:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Click and drag to draw new regions</li>
                <li>Click inside a region to move it</li>
                <li>Drag corner/side handles to resize</li>
                <li>Each image has its own independent regions</li>
                <li>Switch between images to manage their regions separately</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Regions List for Current Image */}
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
              
              return (
                <div
                  key={localIndex}
                  onMouseEnter={() => setHoveredRegionIndex(globalIndex)}
                  onMouseLeave={() => setHoveredRegionIndex(null)}
                  className={`flex items-center justify-between p-3 rounded-md border transition-colors ${
                    hoveredRegionIndex === globalIndex
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{region.region_name}</p>
                    <p className="text-xs text-gray-600 font-mono">
                      x1: {region.x1_ratio.toFixed(3)}, y1: {region.y1_ratio.toFixed(3)}, 
                      x2: {region.x2_ratio.toFixed(3)}, y2: {region.y2_ratio.toFixed(3)}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteRegion(globalIndex)}
                    className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Delete region"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};