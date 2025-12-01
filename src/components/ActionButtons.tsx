import React, { useState } from 'react';
import SaveToFile, { VersionInfo } from './SaveToFile';
import { CacheStats } from './CacheStats';

interface ActionButtonsProps {
  isLoading: boolean;
  isProcessingTutorial: boolean;
  handleCreateTutorial: () => void;
  files: Record<string, string>;
  repoUrl: string;
  onLoadVersion: (files: Record<string, string>, versionInfo: VersionInfo) => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  isLoading,
  isProcessingTutorial,
  handleCreateTutorial,
  files,
  repoUrl,
  onLoadVersion,
}) => {
  const [showCacheStats, setShowCacheStats] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-4 items-center flex-wrap">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm px-4 h-10"
          >
            {isLoading ? "Loading..." : "Crawl Repository"}
          </button>

          <button
            type="button"
            onClick={handleCreateTutorial}
            disabled={isProcessingTutorial}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-green-600 text-white gap-2 hover:bg-green-700 font-medium text-sm px-4 h-10"
          >
            {isProcessingTutorial ? "Processing..." : "Create Tutorial"}
          </button>
          
          <button
            type="button"
            onClick={() => setShowCacheStats(!showCacheStats)}
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-blue-600 text-white gap-2 hover:bg-blue-700 font-medium text-sm px-4 h-10"
          >
            {showCacheStats ? "Hide Cache Stats" : "Show Cache Stats"}
          </button>
        </div>

        {Object.keys(files).length > 0 && (
          <SaveToFile
            files={files}
            repoUrl={repoUrl}
            onLoadVersion={onLoadVersion}
          />
        )}
      </div>
      
      {showCacheStats && (
        <div className="mt-4">
          <CacheStats />
        </div>
      )}
    </div>
  );
};

export default ActionButtons;