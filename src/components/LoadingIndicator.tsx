import React from 'react';

interface LoadingIndicatorProps {
  type: 'repository' | 'tutorial';
  isLoading: boolean;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ type, isLoading }) => {
  if (!isLoading) return null;

  return type === 'repository' ? (
    <div className="flex justify-center items-center h-32">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ) : (
    <div className="flex flex-col justify-center items-center h-64 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
      <p className="text-lg font-medium">Creating tutorial...</p>
      <p className="text-gray-600 dark:text-gray-300 mt-2">
        This might take a few minutes
      </p>
    </div>
  );
};

export default LoadingIndicator;