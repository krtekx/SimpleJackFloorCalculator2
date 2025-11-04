import React, { useState } from 'react';
import { Area } from '../types';
import { Icon } from './Icon';

interface AreaSummaryProps {
  areas: Area[];
  onToggleVisibility: (areaId: number) => void;
  selectedAreaId: number | null;
  onSelectArea: (areaId: number | null) => void;
  totalArea: number;
  totalTilesArea: number;
  isExpanded: boolean;
  onToggle: () => void;
}

export const AreaSummary: React.FC<AreaSummaryProps> = ({ 
  areas, onToggleVisibility, selectedAreaId, onSelectArea, totalArea, totalTilesArea,
  isExpanded, onToggle 
}) => {
  return (
    <div className="relative z-10 w-full">
      <div
        className="flex justify-between items-center cursor-pointer list-none h-9 px-4 bg-gray-800/50 border border-cyan-700/50 rounded-lg backdrop-blur-sm text-white"
        onClick={onToggle}
        title="Show/Hide Area Details (A)"
      >
        <h3 className="text-sm font-medium text-cyan-400 truncate">
          Layout: <span className="text-white">{(totalArea / 1000000).toFixed(2)} m²</span>
          <span className="mx-2 text-cyan-700">|</span>
          Tiles: <span className="text-white">{(totalTilesArea / 1000000).toFixed(2)} m²</span>
        </h3>
        <svg className={`w-5 h-5 text-cyan-400 transition-transform flex-shrink-0 ml-4 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isExpanded && (
        <div className="absolute top-full left-0 w-full mt-1 bg-gray-900/90 border border-cyan-700/50 rounded-lg backdrop-blur-sm text-white max-h-64 overflow-y-auto">
           <div className="flex flex-col space-y-2 p-3">
            {areas.length > 0 ? areas.map(area => {
              const isSelected = selectedAreaId === area.id;
              return (
                <div
                  key={area.id}
                  className={`flex items-center space-x-3 p-2 rounded transition-colors duration-200 cursor-pointer ${isSelected ? 'bg-cyan-500/30' : 'hover:bg-cyan-900/20'}`}
                  onClick={() => onSelectArea(area.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(area.id);
                    }}
                    className="text-gray-400 hover:text-cyan-300 focus:outline-none"
                    title={area.isVisible ? "Hide Area" : "Show Area"}
                  >
                    <Icon icon={area.isVisible ? 'EYE_OPEN' : 'EYE_CLOSED'} className="w-5 h-5" />
                  </button>
                  <div className="flex-grow min-w-0" style={{ opacity: area.isVisible ? 1 : 0.5 }}>
                    <div className="flex items-center space-x-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: area.color }}></span>
                      <span className="font-bold text-cyan-400 truncate">{area.name}</span>
                    </div>
                    {area.isClosed && area.calculationResult && (
                      <div className="text-xs text-gray-400 mt-1 space-y-1">
                        <div>
                          <span>Area: {(area.calculationResult.polygonArea / 1000000).toFixed(2)} m²</span>
                          <span className="mx-2">|</span>
                          <span>Perim: {(area.calculationResult.perimeter / 1000).toFixed(2)} m</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }) : (
              <div className="p-2 text-center text-sm text-gray-500">
                No areas drawn yet.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};