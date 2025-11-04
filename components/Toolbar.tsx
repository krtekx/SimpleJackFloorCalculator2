import React, { useState, useEffect, useRef } from 'react';
import { Tool, Area, TILE_COLORS, VisibilityMode } from '../types';
import { Icon } from './Icon';
import { AreaSummary } from './AreaSummary';

interface ToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onReset: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onSave: () => void;
  onLoad: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomExtents: () => void;
  onEraseClick: () => void;
  zoomInFlash: number;
  zoomOutFlash: number;
  zoomExtentsFlash: number;
  areas: Area[];
  onToggleVisibility: (areaId: number) => void;
  selectedAreaId: number | null;
  onSelectArea: (areaId: number | null) => void;
  totalArea: number;
  totalTilesArea: number;
  isAreaSummaryExpanded: boolean;
  onToggleAreaSummary: () => void;
  onOpenStatsPanel: () => void;
  onOpenFieldDialog: () => void;
  activeColor: string;
  onActiveColorChange: (color: string) => void;
  onCut: () => void;
  onRestore: () => void;
  isCutViewActive: boolean;
  visibilityMode: VisibilityMode;
  onCycleVisibilityMode: () => void;
  onOpenGitHubDialog: () => void;
}

const ToolbarButton: React.FC<{
    onClick: () => void,
    isActive?: boolean,
    disabled?: boolean,
    children: React.ReactNode,
    title?: string,
    isDanger?: boolean,
    isIcon?: boolean,
    className?: string
}> = ({ onClick, isActive = false, disabled = false, children, title, isDanger = false, isIcon = false, className = '' }) => {
    const activeClasses = 'bg-cyan-500/30 border-cyan-400 text-cyan-300';
    const inactiveClasses = 'bg-gray-800/50 border-gray-700 enabled:hover:border-cyan-500 enabled:hover:bg-cyan-900/20 text-gray-400 enabled:hover:text-cyan-300';
    const dangerClasses = 'bg-red-900/50 border-red-700 enabled:hover:border-red-500 enabled:hover:bg-red-800/30 text-red-400 enabled:hover:text-red-300 focus:ring-red-400';
    const baseClasses = `h-9 text-sm font-medium rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center`;
    
    const colorClasses = isDanger ? dangerClasses : (isActive ? activeClasses : inactiveClasses);
    const paddingClasses = isIcon ? 'w-9' : 'px-4';


    return (
        <button
          onClick={onClick}
          disabled={disabled}
          className={`${baseClasses} ${colorClasses} ${paddingClasses} ${className}`}
          title={title}
        >
          {children}
        </button>
    );
};


const useFlash = (trigger: number) => {
    const [isFlashing, setIsFlashing] = useState(false);
    const prevTriggerRef = useRef(trigger);
    useEffect(() => {
      if (trigger > prevTriggerRef.current) {
        setIsFlashing(true);
        const timer = setTimeout(() => setIsFlashing(false), 200);
        return () => clearTimeout(timer);
      }
      prevTriggerRef.current = trigger;
    }, [trigger]);
    return isFlashing;
};

export const Toolbar: React.FC<ToolbarProps> = ({ 
    activeTool, onToolChange, 
    onReset, onUndo, onRedo, canUndo, canRedo,
    onSave, onLoad,
    onZoomIn, onZoomOut, onZoomExtents,
    onEraseClick,
    zoomInFlash, zoomOutFlash, zoomExtentsFlash,
    areas, onToggleVisibility, selectedAreaId, onSelectArea, totalArea, totalTilesArea,
    isAreaSummaryExpanded, onToggleAreaSummary,
    onOpenStatsPanel,
    onOpenFieldDialog,
    activeColor, onActiveColorChange,
    onCut, onRestore, isCutViewActive,
    visibilityMode, onCycleVisibilityMode,
    onOpenGitHubDialog
}) => {
  const zoomInIsFlashing = useFlash(zoomInFlash);
  const zoomOutIsFlashing = useFlash(zoomOutFlash);
  const zoomExtentsIsFlashing = useFlash(zoomExtentsFlash);

  return (
    <div className="absolute top-0 left-0 right-0 flex items-start z-20 pointer-events-none">
      {/* Left Vertical Toolbar */}
      <div className="absolute top-4 left-4 flex flex-col items-start space-y-2 pointer-events-auto">
          <ToolbarButton onClick={onSave} title="Save Project" className="w-24 justify-center" disabled={isCutViewActive}>SAVE</ToolbarButton>
          <ToolbarButton onClick={onLoad} title="Load Project" className="w-24 justify-center" disabled={isCutViewActive}>LOAD</ToolbarButton>
          <ToolbarButton onClick={onOpenGitHubDialog} title="GitHub Integration" className="w-24 justify-center" disabled={isCutViewActive}>
              GITHUB
          </ToolbarButton>
          <div className="w-24 h-px bg-cyan-700/50" />
          <ToolbarButton onClick={() => onToolChange('WALL')} isActive={activeTool === 'WALL'} title="DRAW (D) | Length (L) | Close (C)" className="w-24 justify-center" disabled={isCutViewActive}>
              DRAW
          </ToolbarButton>
          <ToolbarButton onClick={() => onToolChange('MOVE')} isActive={activeTool === 'MOVE'} title="MOVE (M)" className="w-24 justify-center">
              MOVE
          </ToolbarButton>
          <ToolbarButton onClick={() => onToolChange('POINTER')} isActive={activeTool === 'POINTER'} title="EDIT (E)" className="w-24 justify-center">
              EDIT
          </ToolbarButton>
          <ToolbarButton onClick={onEraseClick} isActive={activeTool === 'ERASE'} title="ERASE (X)" className="w-24 justify-center">
              ERASE
          </ToolbarButton>
          <div className="w-24 h-px bg-cyan-700/50" />
          <ToolbarButton onClick={onOpenFieldDialog} isActive={activeTool === 'PLACE_FIELD'} title="Generate Tile Field" className="w-24 justify-center" disabled={isCutViewActive}>
            FIELD
          </ToolbarButton>
          <ToolbarButton onClick={() => onToolChange('TILE')} isActive={activeTool === 'TILE'} title="Place/Delete Single Tile (Shift+Click to Delete)" className="w-24 justify-center" disabled={isCutViewActive}>
            TILE
          </ToolbarButton>
          <ToolbarButton onClick={() => onToolChange('FILL')} isActive={activeTool === 'FILL'} title="Fill area with tiles" className="w-24 justify-center" disabled={isCutViewActive}>
            FILL
          </ToolbarButton>
          <div className="w-24 h-px bg-cyan-700/50" />
           <div className="flex space-x-2">
                <ToolbarButton 
                    onClick={onCut} 
                    isActive={activeTool === 'CUT'} 
                    title="Cut tiles against floor plan" 
                    className="w-24"
                    disabled={isCutViewActive}
                >
                    CUT
                </ToolbarButton>
                {isCutViewActive && (
                    <ToolbarButton
                        onClick={onRestore}
                        title="Restore pre-cut layout"
                        isDanger
                        isIcon
                    >
                        <Icon icon="RESTORE" className="w-5 h-5" />
                    </ToolbarButton>
                )}
            </div>
          <div className="w-24 p-2 bg-gray-800/50 border border-gray-700 rounded-lg">
            <div className="grid grid-cols-5 gap-1">
              {TILE_COLORS.map(color => (
                <button
                  key={color}
                  title={`Set active color to ${color}`}
                  onClick={() => onActiveColorChange(color)}
                  className={`w-4 h-4 rounded-full transition-all duration-150 focus:outline-none ring-offset-2 ring-offset-gray-800 ${activeColor === color ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-cyan-500'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
      </div>

      {/* Top Horizontal Toolbar */}
      <div className="absolute top-4 left-32 right-4 flex justify-between items-start pointer-events-auto">
          {/* This container will group the summary and the right-side controls, pushing the RESET button to the far right */}
          <div className="flex-grow flex items-center space-x-3 min-w-0">
            {/* Center expanding group */}
            <div className="flex-grow min-w-0">
                 <AreaSummary
                    areas={areas}
                    onToggleVisibility={onToggleVisibility}
                    selectedAreaId={selectedAreaId}
                    onSelectArea={onSelectArea}
                    totalArea={totalArea}
                    totalTilesArea={totalTilesArea}
                    isExpanded={isAreaSummaryExpanded}
                    onToggle={onToggleAreaSummary}
                />
            </div>

             {/* Right aligned group */}
            <div className="flex items-center space-x-2 flex-shrink-0">
                 <ToolbarButton onClick={onOpenStatsPanel} title="View Statistics" isIcon>
                    <Icon icon="STATS" className="w-5 h-5" />
                </ToolbarButton>
                 <div className="w-px h-9 bg-cyan-700/50" />
                 <ToolbarButton onClick={onUndo} disabled={!canUndo} title="Undo (U)" isIcon>
                    <Icon icon="UNDO" className="w-5 h-5" />
                </ToolbarButton>
                <ToolbarButton onClick={onRedo} disabled={!canRedo} title="Redo (R)" isIcon>
                    <Icon icon="REDO" className="w-5 h-5" />
                </ToolbarButton>
                <div className="w-px h-9 bg-cyan-700/50" />
                <ToolbarButton onClick={onZoomIn} title="Zoom In (ArrowUp)" isIcon={true} isActive={zoomInIsFlashing}>
                    <Icon icon="ZOOM_IN" className="w-5 h-5" />
                </ToolbarButton>
                <ToolbarButton onClick={onZoomOut} title="Zoom Out (ArrowDown)" isIcon={true} isActive={zoomOutIsFlashing}>
                    <Icon icon="ZOOM_OUT" className="w-5 h-5" />
                </ToolbarButton>
                <ToolbarButton onClick={onZoomExtents} title="Zoom Extents (F)" isIcon={true} isActive={zoomExtentsIsFlashing}>
                    <Icon icon="ZOOM_EXTENTS" className="w-5 h-5" />
                </ToolbarButton>
                <ToolbarButton onClick={() => onToolChange('PAN')} isActive={activeTool === 'PAN'} title="Pan (Hold Space)" isIcon={true}>
                    <Icon icon="PAN" className="w-5 h-5" />
                </ToolbarButton>
                <div className="w-px h-9 bg-cyan-700/50" />
                 <ToolbarButton onClick={onCycleVisibilityMode} title={`Cycle View Mode (V). Current: ${visibilityMode.replace('Only', '')}`} className="w-28 justify-between px-3">
                    <Icon icon="VIEW_MODE" className="w-5 h-5" />
                    <span className="text-xs font-bold">{visibilityMode.replace('Only', '').toUpperCase()}</span>
                </ToolbarButton>
            </div>
          </div>
          <div className="flex items-center space-x-3 flex-shrink-0">
            <div className="w-px h-9 bg-cyan-700/50" />
            <ToolbarButton onClick={onReset} title="Reset Canvas" isDanger className="w-24 justify-center">
                RESET
            </ToolbarButton>
          </div>
      </div>
    </div>
  );
};