import React, { useState, useEffect, useRef } from 'react';
import { Tile, TILE_COLORS } from '../types';

interface TileEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (tileId: number, newColor: string) => void;
  tile: Tile | null;
}

export const TileEditDialog: React.FC<TileEditDialogProps> = ({ isOpen, onClose, onConfirm, tile }) => {
  const [selectedColor, setSelectedColor] = useState(tile?.color || TILE_COLORS[0]);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && tile) {
      setSelectedColor(tile.color);
      setTimeout(() => confirmButtonRef.current?.focus(), 100);
    }
  }, [isOpen, tile]);

  if (!isOpen || !tile) return null;

  const handleConfirmClick = () => {
    onConfirm(tile.id, selectedColor);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirmClick();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-end z-50 pt-16 pr-4" onClick={onClose}>
      <div className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-sm" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h2 className="text-2xl font-bold text-cyan-400 glow-text mb-4">Edit Tile Color</h2>
        <p className="text-cyan-200 mb-6">Select a new color for tile <span className="font-bold">{tile.number}</span>.</p>
        
        <div className="grid grid-cols-5 gap-4 p-4 bg-gray-950/50 border border-cyan-800/50 rounded-lg">
            {TILE_COLORS.map(color => (
                <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-12 h-12 rounded-lg transition-all duration-150 focus:outline-none ring-offset-2 ring-offset-gray-900 ${selectedColor === color ? 'ring-2 ring-cyan-400' : 'hover:ring-1 hover:ring-cyan-500'}`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                />
            ))}
        </div>

        <div className="flex justify-end space-x-4 mt-6">
           <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border-2 transition-all duration-200 bg-gray-800/50 border-gray-700 hover:border-cyan-500 hover:bg-cyan-900/20 text-gray-400 hover:text-cyan-300"
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            onClick={handleConfirmClick}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};