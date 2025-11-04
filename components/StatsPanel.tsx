import React, { useMemo } from 'react';
// Fix: Add Point to the import from types.ts to resolve the 'Cannot find name' error.
import { Area, TILE_COLORS, Tile, CutTilePiece, Point, COLOR_NAMES } from '../types';
import { polygonArea } from '../lib/geometry';

interface StatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  areas: Area[];
  totalTilesArea: number;
  cutPieces: CutTilePiece[] | null;
}

const polygonAreaWithHoles = (polygons: Point[][]): number => {
  if (!polygons || polygons.length === 0) {
    return 0;
  }
  const outerArea = polygonArea(polygons[0]);
  const holesArea = polygons.slice(1).reduce((sum, hole) => sum + polygonArea(hole), 0);
  return outerArea - holesArea;
};

export const StatsPanel: React.FC<StatsPanelProps> = ({ isOpen, onClose, areas, totalTilesArea, cutPieces }) => {
  if (!isOpen) return null;

  const closedAreas = areas.filter(a => a.isClosed && a.calculationResult);
  
  const totalFloorPlanArea = closedAreas.reduce((sum, area) => sum + (area.calculationResult?.polygonArea || 0), 0);
  
  const totalOffcutArea = useMemo(() => {
    if (!cutPieces) return 0;
    return cutPieces
      .filter(p => p.isOffcut)
      .reduce((sum, piece) => sum + polygonAreaWithHoles(piece.polygons), 0);
  }, [cutPieces]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-lg flex flex-col" 
        style={{ maxHeight: '80vh'}}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-cyan-400 glow-text">Statistics Summary</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        <div className="text-cyan-200 flex-grow overflow-y-auto pr-2">
            <div className="space-y-6">
              {(totalFloorPlanArea > 0 || totalTilesArea > 0) && (
                <div className="p-4 bg-yellow-950/30 rounded-lg border border-yellow-800/50" >
                  <h3 className="text-xl font-bold mb-3 text-yellow-400 glow-text">Waste Summary</h3>
                   <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-400">
                      <div>
                          <p>Total Tiles Area:</p>
                          <p className="font-bold text-white text-base">{(totalTilesArea / 1000000).toFixed(2)} m²</p>
                      </div>
                      <div>
                          <p>Total Layout Area:</p>
                          <p className="font-bold text-white text-base">{(totalFloorPlanArea / 1000000).toFixed(2)} m²</p>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-yellow-900/50">
                          <p>Estimated Waste (Offcut):</p>
                          <p className={`font-bold text-base text-white`}>
                            {(totalOffcutArea / 1000000).toFixed(2)} m² 
                            ({totalTilesArea > 0 ? `${((totalOffcutArea / totalTilesArea) * 100).toFixed(1)}%` : '0.0%'})
                          </p>
                      </div>
                  </div>
                </div>
              )}
              {closedAreas.map(area => {
                  const areaTileCounts = area.calculationResult?.tileCountsByColor ? 
                    Object.entries(area.calculationResult.tileCountsByColor).sort(([colorA], [colorB]) => TILE_COLORS.indexOf(colorA) - TILE_COLORS.indexOf(colorB)) 
                    : [];

                  return (
                  <div key={area.id} className="p-4 bg-cyan-950/30 rounded-lg border border-cyan-800/50" >
                      <h3 className="text-xl font-bold mb-3 flex items-center text-cyan-400 glow-text">
                          <span className="w-4 h-4 rounded-full mr-3" style={{ backgroundColor: area.color }}></span>
                          {area.name}
                      </h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-400">
                          <div>
                              <p>Area:</p>
                              <p className="font-bold text-white text-base">{(area.calculationResult!.polygonArea / 1000000).toFixed(2)} m²</p>
                          </div>
                          <div>
                              <p>Perimeter:</p>
                              <p className="font-bold text-white text-base">{(area.calculationResult!.perimeter / 1000).toFixed(2)} m</p>
                          </div>
                      </div>
                      {areaTileCounts.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-cyan-900/50">
                              <h4 className="text-lg font-semibold mb-2 text-cyan-300">Tile Breakdown:</h4>
                               <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                {areaTileCounts.map(([color, count]) => {
                                    // Fix: The value 'count' from Object.entries can be inferred as 'unknown'. Cast to number before calling toFixed.
                                    const displayCount = (count as number).toFixed(2);
                                    return (
                                        <div key={color} className="flex items-center space-x-2 text-sm">
                                            <span className="w-3 h-3 rounded-full border border-gray-500/50" style={{ backgroundColor: color }}></span>
                                            <span className="text-gray-300">{COLOR_NAMES[color] || 'Unknown'}:</span>
                                            <span className="font-bold text-white">{displayCount}</span>
                                        </div>
                                    );
                                })}
                               </div>
                          </div>
                      )}
                  </div>
              )})}
              {closedAreas.length === 0 && (
                 <p className="text-center text-gray-400 mt-8">No closed areas or tiles yet. Complete a floor plan or add tiles to see a summary here.</p>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};