import React, { useState, useEffect, useRef } from 'react';
import { Point, Wall } from '../types';
import { distance } from '../lib/geometry';

interface WallEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onPreviewChange: (params: { newLength: number; fixedPointId: number }) => void;
  wallData: { wall: Wall; p1: Point; p2: Point } | null;
}

const DirectionButton: React.FC<{
    onClick: () => void,
    isActive: boolean,
    children: React.ReactNode,
    title: string
  }> = ({ onClick, isActive, children, title }) => {
    const activeClasses = 'bg-cyan-500/30 border-cyan-400 text-cyan-200';
    const inactiveClasses = 'bg-gray-800/50 border-gray-700 hover:border-cyan-500 hover:bg-cyan-900/20 text-gray-400 hover:text-cyan-300';
    return (
      <button
        onClick={onClick}
        title={title}
        className={`p-2 rounded-lg border-2 transition-all duration-200 w-12 h-12 flex items-center justify-center ${isActive ? activeClasses : inactiveClasses}`}
      >
        {children}
      </button>
    );
  };


export const WallEditDialog: React.FC<WallEditDialogProps> = ({ isOpen, onClose, onConfirm, onPreviewChange, wallData }) => {
  const [length, setLength] = useState('');
  const [fixedPointId, setFixedPointId] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && wallData) {
      const currentLength = distance(wallData.p1, wallData.p2);
      setLength(Math.round(currentLength).toString());
      // Default to clockwise, which means fixing the START point (p1)
      setFixedPointId(wallData.p1.id); 
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen, wallData]);

  useEffect(() => {
    if (isOpen && wallData) {
      const numLength = parseFloat(length);
      if (!isNaN(numLength) && numLength > 0 && fixedPointId !== null) {
        onPreviewChange({ newLength: numLength, fixedPointId });
      }
    }
  }, [isOpen, wallData, length, fixedPointId, onPreviewChange]);


  if (!isOpen || !wallData) return null;

  const handleApply = () => {
    onConfirm();
  };
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation(); // Stop the event from bubbling up to the global zoom handler
      const increment = e.shiftKey ? 10 : 1;
      const currentValue = parseFloat(length) || 0;
      const newValue = e.key === 'ArrowUp' 
        ? currentValue + increment 
        : Math.max(1, currentValue - increment);
      setLength(String(newValue));
    } else if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      handleApply();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-end z-50 pt-16 pr-4" onClick={onClose}>
      <div className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-cyan-400 glow-text mb-4">Edit Wall Length</h2>
        <div className="mb-6">
          <label className="block text-sm font-medium text-cyan-300 mb-2">New Length (mm)</label>
           <div className="flex items-center space-x-3">
              <DirectionButton 
                onClick={() => setFixedPointId(wallData.p1.id)}
                isActive={fixedPointId === wallData.p1.id}
                title="Extend Clockwise"
              >
                  <span className="text-2xl font-sans -mt-1">&lt;</span>
              </DirectionButton>
              <div className="relative w-full">
                <input
                  ref={inputRef}
                  type="number"
                  value={length}
                  onChange={(e) => setLength(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  className="w-full text-center bg-gray-950 border border-cyan-700/50 rounded-md p-2 h-12 text-lg text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
                  min="1"
                />
              </div>
              <DirectionButton
                onClick={() => setFixedPointId(wallData.p2.id)}
                isActive={fixedPointId === wallData.p2.id}
                title="Extend Counter-Clockwise"
              >
                  <span className="text-2xl font-sans -mt-1">&gt;</span>
              </DirectionButton>
          </div>
        </div>
        <div className="flex justify-end space-x-4">
           <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border-2 transition-all duration-200 bg-gray-800/50 border-gray-700 hover:border-cyan-500 hover:bg-cyan-900/20 text-gray-400 hover:text-cyan-300"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};