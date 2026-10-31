import React from 'react';

export const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div
        className={`${sizeClasses[size] || sizeClasses.md} border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin`}
      />
    </div>
  );
};

export default LoadingSpinner;
