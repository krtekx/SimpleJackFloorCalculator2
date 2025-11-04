import React, { useState, useEffect, useRef } from 'react';

interface GitHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  connectedRepo: string | null;
  onConnect: (repoUrl: string) => void;
  onDisconnect: () => void;
  onPush: () => void;
  onPull: () => void;
}

export const GitHubDialog: React.FC<GitHubDialogProps> = ({
  isOpen,
  onClose,
  connectedRepo,
  onConnect,
  onDisconnect,
  onPush,
  onPull,
}) => {
  const [repoUrlInput, setRepoUrlInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !connectedRepo) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, connectedRepo]);
  
  if (!isOpen) return null;

  const handleConnectClick = () => {
    if (repoUrlInput.trim()) {
      onConnect(repoUrlInput.trim());
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnectClick();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-gray-900 border-2 border-cyan-600 rounded-lg p-6 shadow-2xl glow w-full max-w-md flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-cyan-400 glow-text">GitHub Integration</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
        <div className="text-cyan-200 flex-grow">
          {connectedRepo ? (
            <div className="space-y-4">
              <p>
                Connected to: <span className="font-bold text-white break-all">{connectedRepo}</span>
              </p>
              <div className="flex space-x-4">
                <button
                  onClick={onPush}
                  className="flex-1 px-6 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg border-2 border-green-500 transition-all duration-200"
                >
                  Push
                </button>
                <button
                  onClick={onPull}
                  className="flex-1 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg border-2 border-blue-500 transition-all duration-200"
                >
                  Pull
                </button>
              </div>
              <button
                onClick={onDisconnect}
                className="w-full px-4 py-2 mt-4 rounded-lg border-2 transition-all duration-200 bg-red-900/50 border-red-700 hover:border-red-500 hover:bg-red-800/30 text-red-400 hover:text-red-300"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Connect to a GitHub repository to sync your project.</p>
              <div>
                <label className="block text-sm font-medium text-cyan-300 mb-2">Repository URL</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={repoUrlInput}
                  onChange={(e) => setRepoUrlInput(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="https://github.com/user/repo"
                  className="w-full bg-gray-950 border border-cyan-700/50 rounded-md p-2 text-cyan-200 focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
                />
              </div>
              <button
                onClick={handleConnectClick}
                className="w-full px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg border-2 border-cyan-500 transition-all duration-200"
              >
                Connect
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};