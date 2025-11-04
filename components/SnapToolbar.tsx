import React from 'react';
import { Tool } from '../types';

interface SnapToolbarProps {
  snapModes: {
    grid: boolean;
    osnap: boolean;
    otrack: boolean;
  };
  isMasterSnapOn: boolean;
  onToggleMasterSnap: () => void;
  onToggleSnapMode: (mode: 'grid' | 'osnap' | 'otrack') => void;
  onOpenSettings: () => void;
  activeAngleSnap: number | null;
  activeLengthSnap: number | null;
  activeTool: Tool;
}

const SnapButton: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
  className?: string;
  title?: string;
  disabled?: boolean;
}> = ({ onClick, isActive, children, className = '', title, disabled = false }) => (
  <button
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`h-9 px-4 flex items-center justify-center text-sm font-medium rounded-md border transition-all duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
      isActive
        ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
        : 'bg-gray-800/50 border-gray-700 enabled:hover:border-cyan-500 text-gray-400 enabled:hover:text-cyan-300'
    } ${className}`}
  >
    {children}
  </button>
);

export const SnapToolbar: React.FC<SnapToolbarProps> = ({
  snapModes,
  isMasterSnapOn,
  onToggleMasterSnap,
  onToggleSnapMode,
  onOpenSettings,
  activeAngleSnap,
  activeLengthSnap,
  activeTool,
}) => {
  const isPolarSnapOn = activeAngleSnap !== null || activeLengthSnap !== null;
  
  const polarTexts: string[] = [];
  if (activeAngleSnap !== null) polarTexts.push(`ANGLE: ${activeAngleSnap}°`);
  if (activeLengthSnap !== null) polarTexts.push(`DIST: ${activeLengthSnap}mm`);
  const polarLabel = polarTexts.length > 0 ? polarTexts.join(' | ') : 'POLA';

  return (
    <div className="absolute bottom-0 left-0 right-0 flex justify-center p-3 z-10 pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto">
            <SnapButton onClick={onToggleMasterSnap} isActive={isMasterSnapOn && !isPolarSnapOn} title="Toggle all snaps on/off (S)">
                SNAP
            </SnapButton>
            <div className="w-px h-6 bg-cyan-800/50" />
            <SnapButton onClick={() => onToggleSnapMode('grid')} isActive={snapModes.grid && !isPolarSnapOn} title="Snap to grid (G)">
                GRID
            </SnapButton>
            <SnapButton onClick={() => onToggleSnapMode('osnap')} isActive={snapModes.osnap && !isPolarSnapOn} title="Object Snap (vertices, midpoints) (O)">
                OSNA
            </SnapButton>
            <SnapButton onClick={() => onToggleSnapMode('otrack')} isActive={snapModes.otrack && !isPolarSnapOn} title="Object Tracking (extension lines) (T)">
                OTRA
            </SnapButton>
            <div className="w-px h-6 bg-cyan-800/50" />
            <SnapButton onClick={onOpenSettings} isActive={isPolarSnapOn} title="Polar snap settings (angle/distance) (P)">
                 {polarLabel}
            </SnapButton>
        </div>
    </div>
  );
};