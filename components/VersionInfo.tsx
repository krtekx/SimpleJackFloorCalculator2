import React, { useState, useEffect } from 'react';

const VERSION = "1.02";

export const VersionInfo: React.FC = () => {
  const [creationDate, setCreationDate] = useState('');

  useEffect(() => {
    // Set the creation date and time string once on component mount
    setCreationDate(new Date().toLocaleString());
  }, []);

  return (
    <div className="fixed bottom-2 left-2 text-xs text-gray-500 opacity-75 pointer-events-none z-30">
      <span>v{VERSION} | Updated: {creationDate}</span>
    </div>
  );
};
