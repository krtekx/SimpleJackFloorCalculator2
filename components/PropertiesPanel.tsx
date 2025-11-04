import React, { useState, useEffect } from 'react';
import { Point, Wall, TileDimensions, Tool } from '../types';
import { distance } from '../lib/geometry';

interface PropertiesPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  gridColor: string;
  onGridColorChange: (color: string) => void;
  gridThickness: number;
  onGridThicknessChange: (thickness: number) => void;
  gridDashScale: number;
  onGridDashScaleChange: (scale: number) => void;
  borderThickness: number;
  onBorderThicknessChange: (thickness: number) => void;
  tileNumberFontSize: number;
  onTileNumberFontSizeChange: (size: number) => void;
  dimensionFontSize: number;
  onDimensionFontSizeChange: (size: number) => void;
  hatchScale: number;
  onHatchScaleChange: (scale: number) => void;
  tileDimensions: TileDimensions;
  onTileDimensionsChange: (dims: Partial<TileDimensions>) => void;
  isTileRatioLocked: boolean;
  onToggleTileRatioLock: () => void;
  activeTool: Tool;
  isDrawing: boolean;
  activeAreaPointsLength: number;
  onAddPointWithAngleAndLength: (params: { length: number; angle: number }) => void;
  edgePanMargin: number;
  onEdgePanMarginChange: (value: number) => void;
  edgePanDelay: number;
  onEdgePanDelayChange: (value: number) => void;
  edgePanSpeed: number;
  onEdgePanSpeedChange: (value: number) => void;
}

const InputField: React.FC<{ label: string; value: number | string; onChange: (val: any) => void; unit?: string; min?: number; type?: string; step?: number; }> = ({ label, value, onChange, unit, min = 0, type = "number", step }) => (
    <div>
        <label className="block text-sm font-medium text-cyan-300 mb-1">{label}</label>
        <div className="flex items-center">
            <input
                type={type}
                value={value}
                min={min}
                step={step}
                onChange={(e) => onChange(type === "number" ? Math.max(min, parseFloat(e.target.value) || 0) : e.target.value)}
                className="w-full bg-gray-900 border border-cyan-700/50 rounded-md p-2 text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
            />
            {unit && <span className="ml-2 text-cyan-500">{unit}</span>}
        </div>
    </div>
);

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  isOpen, onToggle,
  gridColor, onGridColorChange,
  gridThickness, onGridThicknessChange,
  gridDashScale, onGridDashScaleChange,
  borderThickness, onBorderThicknessChange,
  tileNumberFontSize, onTileNumberFontSizeChange,
  dimensionFontSize, onDimensionFontSizeChange,
  hatchScale, onHatchScaleChange,
  tileDimensions, onTileDimensionsChange, isTileRatioLocked, onToggleTileRatioLock,
  activeTool, isDrawing, activeAreaPointsLength, onAddPointWithAngleAndLength,
  edgePanMargin, onEdgePanMarginChange,
  edgePanDelay, onEdgePanDelayChange,
  edgePanSpeed, onEdgePanSpeedChange
}) => {
  const [newPointLength, setNewPointLength] = useState(1000);
  const [newPointAngle, setNewPointAngle] = useState(0);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(true);

  const handleApplyAssistant = () => {
    onAddPointWithAngleAndLength({ length: newPointLength, angle: newPointAngle });
  };

  return (
    <div className={`absolute top-0 right-0 h-full w-80 bg-gray-900/50 border-l border-cyan-700/50 backdrop-blur-sm transition-transform duration-300 ease-in-out z-20 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <button 
        onClick={onToggle} 
        className="absolute top-1/2 -left-8 -translate-y-1/2 w-8 h-20 bg-gray-900/50 border border-r-0 border-cyan-700/50 rounded-l-lg flex items-center justify-center text-cyan-400 hover:bg-cyan-900/20"
        title={isOpen ? "Collapse Panel" : "Expand Panel"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div className="p-4 flex flex-col space-y-6 overflow-y-auto h-full">
        <div>
          <h2 className="text-xl font-bold text-cyan-400 glow-text mb-4 text-center">SETTINGS</h2>
          <div className="space-y-4">
              <InputField label="Tile Width" value={tileDimensions.width} onChange={(val) => onTileDimensionsChange({ width: val })} unit="mm" />
              <div className="flex justify-center">
                   <button onClick={onToggleTileRatioLock} className={`p-2 rounded-full transition-colors border ${isTileRatioLocked ? 'bg-cyan-500/30 text-cyan-300 border-cyan-400' : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:border-cyan-500'}`} title={isTileRatioLocked ? "Unlock Ratio" : "Lock Ratio"}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {isTileRatioLocked ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8zM7 7V7a4 4 0 014-4v0a4 4 0 014 4v4" />}
                      </svg>
                  </button>
              </div>
              <InputField label="Tile Height" value={tileDimensions.height} onChange={(val) => onTileDimensionsChange({ height: val })} unit="mm" />
              <details open={isAppearanceOpen} onToggle={(e) => setIsAppearanceOpen((e.target as HTMLDetailsElement).open)}>
                  <summary className="text-lg font-semibold text-cyan-400 cursor-pointer select-none">Appearance</summary>
                  <div className="pl-2 pt-4 space-y-4 border-l border-dotted border-cyan-900 ml-1">
                      <InputField label="Grid Color" type="text" value={gridColor} onChange={onGridColorChange} />
                      <InputField label="Grid Thickness" value={gridThickness} onChange={onGridThicknessChange} unit="px" min={0} step={0.1} />
                      <InputField label="Grid Dash Scale" value={gridDashScale} onChange={onGridDashScaleChange} unit="px" min={0} />
                      <InputField label="Border Thickness" value={borderThickness} onChange={onBorderThicknessChange} unit="px" min={1} />
                      <InputField label="Tile Number Font Size" value={tileNumberFontSize} onChange={onTileNumberFontSizeChange} unit="px" min={1} />
                      <InputField label="Dimension Font Size" value={dimensionFontSize} onChange={onDimensionFontSizeChange} unit="px" min={1} />
                      <InputField label="Hatch Scale" value={hatchScale} onChange={onHatchScaleChange} unit="px" min={1} />
                  </div>
              </details>
               <details>
                  <summary className="text-lg font-semibold text-cyan-400 cursor-pointer select-none">Canvas Behavior</summary>
                  <div className="pl-2 pt-4 space-y-4 border-l border-dotted border-cyan-900 ml-1">
                      <InputField label="Edge Pan Margin" value={edgePanMargin} onChange={onEdgePanMarginChange} unit="px" min={0} />
                      <InputField label="Edge Pan Delay" value={edgePanDelay} onChange={onEdgePanDelayChange} unit="ms" min={0} />
                      <InputField label="Edge Pan Speed" value={edgePanSpeed} onChange={onEdgePanSpeedChange} unit="units/frame" min={0.1} step={0.1} />
                  </div>
              </details>
          </div>
        </div>

        {isDrawing && activeTool === 'WALL' && (
          <div>
              <hr className="border-t border-dashed border-cyan-800/50 mb-4" />
              <h2 className="text-xl font-bold text-cyan-400 glow-text mb-4 text-center">DRAWING ASSISTANT</h2>
              <div className="space-y-4">
                  <InputField label="Length" value={newPointLength} onChange={setNewPointLength} unit="mm" />
                  <InputField label={activeAreaPointsLength > 1 ? "Relative Angle" : "Angle"} value={newPointAngle} onChange={setNewPointAngle} unit="°" min={-360} />
                   <button 
                      onClick={handleApplyAssistant}
                      className="w-full px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border border-cyan-500 transition-all duration-200"
                  >Apply</button>
              </div>
          </div>
        )}
      </div>
    </div>
  );
};