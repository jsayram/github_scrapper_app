import React from 'react';
import { FileStats } from '@/lib/githubFileCrawler';
import { VersionInfo } from './SaveToFile';

interface StatsDisplayProps {
  stats: FileStats;
  activeVersion: VersionInfo | null;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ stats, activeVersion }) => {
  return (
    <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold mb-2">
        {activeVersion ? "Saved Version Info" : "Repository Stats"}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-lg font-bold">
            {stats.downloaded_count}
          </span>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Files Downloaded
          </p>
        </div>
        {activeVersion ? (
          <div>
            <span className="text-lg font-bold">
              {new Date(activeVersion.timestamp).toLocaleDateString()}
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Date Saved
            </p>
          </div>
        ) : (
          <div>
            <span className="text-lg font-bold">
              {stats.skipped_count}
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Files Skipped
            </p>
          </div>
        )}

        {/* Display API method and request count if available */}
        {!activeVersion && stats.method && (
          <div>
            <span className="text-lg font-bold">
              {stats.method === "tree_api"
                ? "Git Tree API"
                : "Contents API"}
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              API Method
            </p>
          </div>
        )}

        {!activeVersion && stats.api_requests !== undefined && (
          <div>
            <span className="text-lg font-bold">
              {stats.api_requests}
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              API Requests
            </p>
          </div>
        )}

        {stats.base_path && (
          <div className="col-span-2">
            <span className="text-sm font-mono">{stats.base_path}</span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Base Path
            </p>
          </div>
        )}

        {/* Display information about excluded files that would have been included */}
        {stats.excluded_count && stats.excluded_count > 0 && (
          <div className="col-span-full mt-2">
            <div className="flex items-center text-amber-700 dark:text-amber-300 mb-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">
                {stats.excluded_count}{" "}
                {stats.excluded_count === 1 ? "file was" : "files were"}{" "}
                excluded by excluded file type patterns or you didn't
                select any include patterns.
              </span>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md text-sm">
              <p className="mb-2">
                These files match your include patterns but were
                automatically excluded due to system exclude rules:
              </p>
              <div className="max-h-32 overflow-y-auto">
                <ul className="list-disc list-inside text-xs font-mono space-y-1">
                  {stats.excluded_files &&
                    stats.excluded_files.map((file, index) => (
                      <li key={index} className="truncate">
                        {file}
                      </li>
                    ))}
                </ul>
              </div>
              <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                The exclude patterns are in place to avoid downloading
                binary files, compiled output, system files, and very
                large files that could cause rate limiting issues. These
                files wont add any value to your analysis of the codebase.
                Excluded files are not counted in the stats.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsDisplay;