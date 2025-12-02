import React, { useState } from 'react';
import SaveToFile, { VersionInfo } from './SaveToFile';
import { CacheStats } from './CacheStats';

interface ActionButtonsProps {
  isLoading: boolean;
  isProcessingTutorial: boolean;
  isDetecting?: boolean;
  handleDetectFileTypes?: () => void;
  handleCreateTutorial: () => void;
  files: Record<string, string>;
  repoUrl: string;
  onLoadVersion: (files: Record<string, string>, versionInfo: VersionInfo) => void;
  hasFiles?: boolean;
  hasTutorial?: boolean;
  onViewTutorial?: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  isLoading,
  isProcessingTutorial,
  isDetecting = false,
  handleDetectFileTypes,
  handleCreateTutorial,
  files,
  repoUrl,
  onLoadVersion,
  hasFiles = false,
  hasTutorial = false,
  onViewTutorial,
}) => {
  const [showCacheStats, setShowCacheStats] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const fileCount = Object.keys(files).length;

  return (
    <div className="space-y-4">
      {/* Main Actions Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Step 1: Detect File Types (Quick scan) */}
        {handleDetectFileTypes && (
          <button
            type="button"
            onClick={handleDetectFileTypes}
            disabled={isDetecting || isLoading}
            className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDetecting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Detecting...</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span>Detect File Types</span>
              </>
            )}
          </button>
        )}

        {/* Step 2: Crawl with selected patterns */}
        <button
          type="submit"
          disabled={isLoading || isDetecting}
          className="group relative flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Crawling...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Crawl Repository</span>
            </>
          )}
        </button>

        {/* Arrow separator */}
        {hasFiles && (
          <svg className="w-5 h-5 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}

        {/* Step 3: Create Tutorial (only show when files are loaded) */}
        <button
          type="button"
          onClick={handleCreateTutorial}
          disabled={isProcessingTutorial || !hasFiles}
          className={`group relative flex items-center gap-2 px-5 py-2.5 font-medium rounded-lg shadow-md transition-all ${
            hasFiles
              ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white hover:shadow-lg'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
          } disabled:opacity-50`}
        >
          {isProcessingTutorial ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Select Files & Generate</span>
              {hasFiles && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">
                  {fileCount}
                </span>
              )}
            </>
          )}
        </button>

        {/* Arrow separator */}
        {hasTutorial && (
          <svg className="w-5 h-5 text-gray-400 hidden sm:block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}

        {/* Step 3: View Tutorial (only show when tutorial exists) */}
        {hasTutorial && onViewTutorial && (
          <button
            type="button"
            onClick={onViewTutorial}
            className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>View Tutorial</span>
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Secondary actions */}
        <div className="flex items-center gap-2">
          {/* Cache Stats Toggle */}
          <button
            type="button"
            onClick={() => setShowCacheStats(!showCacheStats)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
              showCacheStats
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            <span className="hidden sm:inline">Cache</span>
          </button>

          {/* Versions Toggle */}
          <button
            type="button"
            onClick={() => setShowVersions(!showVersions)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all ${
              showVersions
                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">Versions</span>
          </button>
        </div>
      </div>

      {/* File count indicator when files are loaded */}
      {hasFiles && !showCacheStats && !showVersions && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
          <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-blue-700 dark:text-blue-300">
            <strong>{fileCount}</strong> files ready for tutorial generation
          </span>
          <span className="text-blue-500 dark:text-blue-400">•</span>
          <span className="text-blue-600 dark:text-blue-400">
            Click &quot;Select Files & Generate&quot; to choose which files to include
          </span>
        </div>
      )}

      {/* Cache Stats Panel */}
      {showCacheStats && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <CacheStats />
        </div>
      )}

      {/* Versions Panel - always show when toggled, even without files loaded */}
      {showVersions && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <SaveToFile
            files={files}
            repoUrl={repoUrl}
            onLoadVersion={onLoadVersion}
          />
        </div>
      )}
    </div>
  );
};

export default ActionButtons;