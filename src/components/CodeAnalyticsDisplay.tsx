import React from 'react';

export interface CodeAnalytics {
  totalLines: number;
  totalFiles: number;
  languageDistribution: Record<string, number>;
  fileExtensions: Record<string, number>;
  avgLinesPerFile: number;
  totalFunctions: number;
  totalClasses: number;
  commentRatio: number;
}

interface CodeAnalyticsDisplayProps {
  analytics: CodeAnalytics;
}

const CodeAnalyticsDisplay: React.FC<CodeAnalyticsDisplayProps> = ({ analytics }) => {
  return (
    <div className="border rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 mr-2"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 101.414 1.414L10 15.414l2.293 2.293a1 1 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 100-2H3zm11.707 4.707a1 1 00-1.414-1.414L10 9.586 8.707 8.293a1 1 00-1.414 0l-2 2a1 1 101.414 1.414L8 10.414l1.293 1.293a1 1 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        Repository Analytics for Recruiters
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Key Metrics */}
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
              Key Metrics
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-2xl font-bold">
                  {analytics.totalFiles}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Total Files
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {analytics.totalLines.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Lines of Code
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {analytics.totalFunctions}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Functions
                </div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {analytics.totalClasses}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Classes
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
              Avg {Math.round(analytics.avgLinesPerFile)} lines per
              file
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
              Code Quality Indicators
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Comment Ratio</span>
                  <span>
                    {(analytics.commentRatio * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full">
                  <div
                    className="bg-green-500 h-1.5 rounded-full"
                    style={{
                      width: `${Math.min(
                        100,
                        analytics.commentRatio * 200
                      )}%`,
                    }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {analytics.commentRatio > 0.1
                    ? "Good documentation"
                    : "Could use more comments"}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Code Complexity</span>
                  <span>
                    {Math.round(
                      analytics.totalFunctions /
                        Math.max(1, analytics.totalFiles)
                    )}
                    /file
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {analytics.totalFunctions /
                    Math.max(1, analytics.totalFiles) <
                  5
                    ? "Good modularization"
                    : "Some files may be too complex"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Language Distribution */}
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
            Programming Languages
          </h3>
          <div className="space-y-2">
            {Object.entries(analytics.languageDistribution)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([language, count]) => (
                <div key={language}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{language}</span>
                    <span>{count} files</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          (count / analytics.totalFiles) * 100
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* File Extensions */}
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
            File Extensions
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(analytics.fileExtensions)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([ext, count]) => (
                <div
                  key={ext}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="font-mono">.{ext}</span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {count}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Project Complexity */}
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2">
            Project Complexity
          </h3>

          <div className="space-y-3">
            {/* Calculate different complexity metrics */}
            <div>
              <div className="flex justify-between text-sm">
                <span>Overall Size</span>
                <span className="font-medium">
                  {analytics.totalLines < 1000
                    ? "Small"
                    : analytics.totalLines < 10000
                    ? "Medium"
                    : "Large"}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span>Architecture</span>
                <span className="font-medium">
                  {analytics.totalFiles < 10
                    ? "Simple"
                    : analytics.totalFiles < 50
                    ? "Moderate"
                    : "Complex"}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span>Technical Debt</span>
                <span className="font-medium">
                  {analytics.commentRatio > 0.1 &&
                  analytics.totalFunctions /
                    Math.max(1, analytics.totalFiles) <
                    5
                    ? "Low"
                    : "Moderate"}
                </span>
              </div>
            </div>

            <div className="text-xs text-gray-600 dark:text-gray-300 pt-2">
              {Object.keys(analytics.languageDistribution).length}{" "}
              languages used across the project
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeAnalyticsDisplay;