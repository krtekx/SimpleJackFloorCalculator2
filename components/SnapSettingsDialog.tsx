import React, { useEffect, useRef, useState } from 'react';
import { SnapButtonGroup } from './SnapButtonGroup';

interface SnapSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  activeAngleSnap: number | null;
  onAngleSnapChange: (snap: number | null) => void;
  activeLengthSnap: number | null;
  onLengthSnapChange: (snap: number | null) => void;
}

const PRESET_ANGLES = [1, 5, 10, 15, 30, 45, 90];
const PRESET_LENGTHS = [10, 50, 100, 250, 500, 1000];

const CustomInput: React.FC<{
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSet: () => void;
    unit: string;
}> = ({ value, onChange, onSet, unit }) => (
    <div className="relative">
        <input
            type="number"
            value={value}
            onChange={onChange}
            onBlur={onSet}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Custom"
            className="w-full bg-gray-950 border border-cyan-700/50 rounded-md p-2 pl-3 pr-12 text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
            min="0"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 pointer-events-none">{unit}</span>
    </div>
);

export const SnapSettingsDialog: React.FC<SnapSettingsDialogProps> = ({ 
    isOpen, onClose, 
    activeAngleSnap, onAngleSnapChange, 
    activeLengthSnap, onLengthSnapChange 
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  const [customAngle, setCustomAngle] = useState(
    !PRESET_ANGLES.includes(activeAngleSnap ?? 0) && activeAngleSnap ? String(activeAngleSnap) : ''
  );
  const [customLength, setCustomLength] = useState(
    !PRESET_LENGTHS.includes(activeLengthSnap ?? 0) && activeLengthSnap ? String(activeLengthSnap) : ''
  );

  useEffect(() => {
    if (isOpen) {
      setCustomAngle(!PRESET_ANGLES.includes(activeAngleSnap ?? 0) && activeAngleSnap ? String(activeAngleSnap) : '');
      setCustomLength(!PRESET_LENGTHS.includes(activeLengthSnap ?? 0) && activeLengthSnap ? String(activeLengthSnap) : '');
    }
  }, [isOpen, activeAngleSnap, activeLengthSnap]);
  
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => { window.removeEventListener('keydown', handleKeyDown); };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAnglePresetChange = (val: number | null) => {
    onAngleSnapChange(activeAngleSnap === val ? null : val);
    setCustomAngle('');
  };
  const handleLengthPresetChange = (val: number | null) => {
    onLengthSnapChange(activeLengthSnap === val ? null : val);
    setCustomLength('');
  };

  const handleCustomAngleSet = () => {
    const value = parseFloat(customAngle);
    if (!isNaN(value) && value > 0) {
      onAngleSnapChange(value);
    } else if (customAngle === '') {
      if (!PRESET_ANGLES.includes(activeAngleSnap ?? 0)) {
        onAngleSnapChange(null);
      }
    }
  };
  const handleCustomLengthSet = () => {
    const value = parseFloat(customLength);
    if (!isNaN(value) && value > 0) {
      onLengthSnapChange(value);
    } else if (customLength === '') {
      if (!PRESET_LENGTHS.includes(activeLengthSnap ?? 0)) {
        onLengthSnapChange(null);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-end z-50 pt-16 pr-4" onClick={onClose}>
      <div ref={dialogRef} className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-cyan-400 glow-text mb-6">Polar Snap Settings</h2>
        <div className="space-y-6">
          <div>
            <SnapButtonGroup
              label="Snap Angle"
              values={PRESET_ANGLES}
              activeValue={activeAngleSnap}
              onValueChange={handleAnglePresetChange}
              unit="°"
            />
            <div className="mt-3">
              <CustomInput 
                value={customAngle}
                onChange={(e) => setCustomAngle(e.target.value)}
                onSet={handleCustomAngleSet}
                unit="°"
              />
            </div>
          </div>
          <div>
            <SnapButtonGroup
              label="Snap Distance"
              values={PRESET_LENGTHS}
              activeValue={activeLengthSnap}
              onValueChange={handleLengthPresetChange}
              unit="mm"
            />
            <div className="mt-3">
              <CustomInput 
                value={customLength}
                onChange={(e) => setCustomLength(e.target.value)}
                onSet={handleCustomLengthSet}
                unit="mm"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-8">
           <button
            onClick={onClose}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};