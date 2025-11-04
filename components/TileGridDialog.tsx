import React, { useState, useEffect, useRef } from 'react';

interface FieldDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (params: { width: number; height: number; rows: number; cols: number }) => void;
  initialDimensions: { width: number; height: number };
}

const InputField: React.FC<{ label: string; value: number | string; onChange: (val: any) => void; unit?: string; min?: number; }> = ({ label, value, onChange, unit, min = 1 }) => (
    <div>
        <label className="block text-sm font-medium text-cyan-300 mb-1">{label}</label>
        <div className="flex items-center">
            <input
                type="number"
                value={value}
                min={min}
                onChange={(e) => onChange(Math.max(min, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-gray-900 border border-cyan-700/50 rounded-md p-2 text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
            />
            {unit && <span className="ml-2 text-cyan-500">{unit}</span>}
        </div>
    </div>
);

export const FieldDialog: React.FC<FieldDialogProps> = ({ isOpen, onClose, onGenerate, initialDimensions }) => {
  const [width, setWidth] = useState(initialDimensions.width);
  const [height, setHeight] = useState(initialDimensions.height);
  const [rows, setRows] = useState(10);
  const [cols, setCols] = useState(10);
  const generateButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setWidth(initialDimensions.width);
      setHeight(initialDimensions.height);
      setTimeout(() => generateButtonRef.current?.focus(), 100);
    }
  }, [isOpen, initialDimensions]);

  if (!isOpen) return null;

  const handleGenerateClick = () => {
    if (width > 0 && height > 0 && rows > 0 && cols > 0) {
      onGenerate({ width, height, rows, cols });
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleGenerateClick();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-end z-50 pt-16 pr-4" onClick={onClose}>
      <div className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-sm" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h2 className="text-2xl font-bold text-cyan-400 glow-text mb-4">Generate Tile Field</h2>
        <div className="space-y-4">
            <InputField label="Tile Width" value={width} onChange={setWidth} unit="mm" />
            <InputField label="Tile Height" value={height} onChange={setHeight} unit="mm" />
            <InputField label="Columns" value={cols} onChange={setCols} />
            <InputField label="Rows" value={rows} onChange={setRows} />
        </div>
        <div className="flex justify-end space-x-4 mt-6">
           <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border-2 transition-all duration-200 bg-gray-800/50 border-gray-700 hover:border-cyan-500 hover:bg-cyan-900/20 text-gray-400 hover:text-cyan-300"
          >
            Cancel
          </button>
          <button
            ref={generateButtonRef}
            onClick={handleGenerateClick}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  );
};
