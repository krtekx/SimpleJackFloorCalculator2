import React, { useState, useEffect, useRef } from 'react';

interface InputDialogProps {
  isOpen: boolean;
  onConfirm: (value: number) => void;
  onClose: () => void;
  title: string;
  label: string;
}

export const InputDialog: React.FC<InputDialogProps> = ({ isOpen, onConfirm, onClose, title, label }) => {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(''); // Reset on open
      // Delay focus to allow for CSS transitions and rendering
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue) && numValue > 0) {
      onConfirm(numValue);
    } else {
        onClose(); // Close if input is invalid
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-end z-50 pt-16 pr-4" onClick={onClose}>
      <div className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-cyan-400 glow-text mb-4">{title}</h2>
        <div className="mb-6">
          <label className="block text-sm font-medium text-cyan-300 mb-2">{label}</label>
          <input
            ref={inputRef}
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-gray-950 border border-cyan-700/50 rounded-md p-2 text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
            min="1"
          />
        </div>
        <div className="flex justify-end space-x-4">
           <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border-2 transition-all duration-200 bg-gray-800/50 border-gray-700 hover:border-cyan-500 hover:bg-cyan-900/20 text-gray-400 hover:text-cyan-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};