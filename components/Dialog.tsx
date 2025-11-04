import React, { useEffect, useRef } from 'react';

interface DialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
}

export const Dialog: React.FC<DialogProps> = ({ isOpen, onConfirm, onClose, title, children, confirmText, cancelText }) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus the confirm button when the dialog opens for better UX
      setTimeout(() => confirmButtonRef.current?.focus(), 100);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onConfirm();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, onConfirm, onClose]);


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-start justify-end z-50 pt-16 pr-4" onClick={onClose}>
      <div className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h2 className="text-2xl font-bold text-cyan-400 glow-text mb-4">{title}</h2>
        <div className="text-cyan-200 mb-6">
          {children}
        </div>
        <div className="flex justify-end space-x-4">
           <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border-2 transition-all duration-200 bg-gray-800/50 border-gray-700 hover:border-cyan-500 hover:bg-cyan-900/20 text-gray-400 hover:text-cyan-300"
          >
            {cancelText || 'Cancel'}
          </button>
          <button
            ref={confirmButtonRef}
            onClick={onConfirm}
            className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-cyan-400"
          >
            {confirmText || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};