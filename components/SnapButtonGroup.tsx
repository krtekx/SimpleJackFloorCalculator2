import React from 'react';

export const SnapButtonGroup: React.FC<{
  label: string;
  values: number[];
  activeValue: number | null;
  onValueChange: (value: number | null) => void;
  unit: string;
}> = ({ label, values, activeValue, onValueChange, unit }) => (
  <div>
    <label className="block text-sm font-medium text-cyan-300 mb-2">{label}</label>
    <div className="flex flex-wrap gap-2">
      {values.map(val => (
        <button
          key={val}
          onClick={() => onValueChange(activeValue === val ? null : val)}
          className={`px-3 py-1.5 text-sm rounded border transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-cyan-300 ${
            activeValue === val
              ? 'bg-cyan-500/30 border-cyan-400 text-cyan-200'
              : 'bg-gray-800/50 border-gray-700 hover:border-cyan-500 text-gray-400 hover:text-cyan-300'
          }`}
        >
          {val}{unit}
        </button>
      ))}
    </div>
  </div>
);
