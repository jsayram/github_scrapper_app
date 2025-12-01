import React from 'react';

export interface TutorialProgress {
  stage: string;
  message: string;
  progress: number;
  currentChapter?: number;
  totalChapters?: number;
  chapterName?: string;
}

interface LoadingIndicatorProps {
  type: 'repository' | 'tutorial';
  isLoading: boolean;
  progress?: TutorialProgress | null;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ type, isLoading, progress }) => {
  if (!isLoading) return null;

  return type === 'repository' ? (
    <div className="flex justify-center items-center h-32">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  ) : (
    <div className="flex flex-col justify-center items-center py-8 px-6 bg-gray-50 dark:bg-gray-800 rounded-lg mb-6">
      {/* Progress Bar */}
      <div className="w-full max-w-md mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-500 ease-out"
            style={{ width: `${progress?.progress || 0}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
          <span>{progress?.progress || 0}%</span>
          <span>100%</span>
        </div>
      </div>
      
      {/* Spinner */}
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-green-500 mb-4"></div>
      
      {/* Stage Title */}
      <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
        {progress?.stage === 'writing_chapters' ? 'Writing Tutorial Chapters' : 'Creating Tutorial...'}
      </p>
      
      {/* Progress Message */}
      <p className="text-gray-600 dark:text-gray-300 mt-2 text-center">
        {progress?.message || 'This might take a few minutes'}
      </p>
      
      {/* Chapter Progress */}
      {progress?.currentChapter && progress?.totalChapters && (
        <div className="mt-4 px-4 py-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 w-full max-w-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Chapter Progress
            </span>
            <span className="text-sm font-bold text-green-600 dark:text-green-400">
              {progress.currentChapter} / {progress.totalChapters}
            </span>
          </div>
          
          {/* Chapter dots */}
          <div className="flex gap-1 flex-wrap">
            {Array.from({ length: progress.totalChapters }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-colors ${
                  i < progress.currentChapter
                    ? 'bg-green-500'
                    : i === progress.currentChapter - 1
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          
          {/* Current Chapter Name */}
          {progress.chapterName && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 truncate">
              📝 {progress.chapterName}
            </p>
          )}
        </div>
      )}
      
      {/* Estimated Time */}
      {progress?.totalChapters && progress?.currentChapter && (
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          ⏱️ ~{Math.max(1, (progress.totalChapters - progress.currentChapter) * 30)} seconds remaining
        </p>
      )}
    </div>
  );
};

export default LoadingIndicator;