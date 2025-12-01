'use client';

/**
 * Cache Status Preview Component
 * Shows cache status for a repository and previews what would be regenerated
 */

import React, { useState, useCallback } from 'react';

interface ChangeAnalysis {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  changePercentage: number;
}

interface RegenerationPlan {
  mode: 'full' | 'partial' | 'skip' | 'partial_reidentify';
  reason: string;
  chaptersToRegenerate: string[];
  rerunAbstractionIdentification: boolean;
  estimatedSavings: number;
}

interface CacheCheckResult {
  cached: boolean;
  lastCrawlTime?: string;
  cachedFiles?: number;
  cachedChapters?: number;
  changeAnalysis?: ChangeAnalysis;
  regenerationPlan?: RegenerationPlan;
  abstractions?: string[];
  message?: string;
  error?: string;
}

interface CacheStatusPreviewProps {
  repoUrl: string;
  files?: Array<{ path: string; content: string }>;
  onModeSelect?: (mode: 'full' | 'partial' | 'skip') => void;
  className?: string;
}

export function CacheStatusPreview({
  repoUrl,
  files,
  onModeSelect,
  className = '',
}: CacheStatusPreviewProps) {
  const [result, setResult] = useState<CacheCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'auto' | 'full' | 'partial' | 'skip'>('auto');

  const checkCache = useCallback(async () => {
    if (!repoUrl) {
      setError('Please enter a repository URL first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const body: { repoUrl: string; files?: Array<{ path: string; content: string }> } = { repoUrl };
      
      // Include files for change analysis if available
      if (files && files.length > 0) {
        body.files = files;
      }

      const response = await fetch('/api/check-repo-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: CacheCheckResult = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check cache');
    } finally {
      setLoading(false);
    }
  }, [repoUrl, files]);

  const handleModeChange = (mode: 'auto' | 'full' | 'partial' | 'skip') => {
    setSelectedMode(mode);
    if (mode !== 'auto' && onModeSelect) {
      onModeSelect(mode);
    } else if (mode === 'auto' && result?.regenerationPlan && onModeSelect) {
      onModeSelect(result.regenerationPlan.mode === 'partial_reidentify' ? 'full' : result.regenerationPlan.mode);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'skip': return '✅';
      case 'partial': return '🔄';
      case 'full': return '🔨';
      case 'partial_reidentify': return '🔍';
      default: return '❓';
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'skip': return 'text-green-600 dark:text-green-400';
      case 'partial': return 'text-blue-600 dark:text-blue-400';
      case 'full': return 'text-orange-600 dark:text-orange-400';
      case 'partial_reidentify': return 'text-purple-600 dark:text-purple-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className={`border rounded-md p-4 bg-gray-50 dark:bg-gray-800/50 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium flex items-center gap-2">
          💾 Cache Status
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            Check for existing tutorial cache
          </span>
        </h3>
        <button
          onClick={checkCache}
          disabled={loading || !repoUrl}
          className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Checking...' : 'Check Cache'}
        </button>
      </div>

      {error && (
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Cache Status */}
          <div className={`p-3 rounded ${result.cached ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
            {result.cached ? (
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">
                  ✅ Cache Found
                </p>
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400 grid grid-cols-2 gap-2">
                  <span>Last updated: {formatDate(result.lastCrawlTime!)}</span>
                  <span>Files: {result.cachedFiles}</span>
                  <span>Chapters: {result.cachedChapters}</span>
                  {result.abstractions && (
                    <span>Abstractions: {result.abstractions.length}</span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                📭 {result.message || 'No cache found - will generate fresh'}
              </p>
            )}
          </div>

          {/* Change Analysis (if available) */}
          {result.changeAnalysis && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                📊 Change Analysis
              </p>
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center">
                  <div className="font-semibold text-green-600">{result.changeAnalysis.added}</div>
                  <div className="text-gray-500">Added</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-yellow-600">{result.changeAnalysis.modified}</div>
                  <div className="text-gray-500">Modified</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-red-600">{result.changeAnalysis.removed}</div>
                  <div className="text-gray-500">Removed</div>
                </div>
                <div className="text-center">
                  <div className="font-semibold text-gray-600">{result.changeAnalysis.unchanged}</div>
                  <div className="text-gray-500">Same</div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-500 text-center">
                {result.changeAnalysis.changePercentage.toFixed(1)}% files changed
              </div>
            </div>
          )}

          {/* Regeneration Plan */}
          {result.regenerationPlan && (
            <div className="p-3 bg-white dark:bg-gray-800 border rounded">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{getModeIcon(result.regenerationPlan.mode)}</span>
                <span className={`text-sm font-medium ${getModeColor(result.regenerationPlan.mode)}`}>
                  {result.regenerationPlan.mode === 'skip' && 'Ready to Use'}
                  {result.regenerationPlan.mode === 'partial' && 'Partial Regeneration'}
                  {result.regenerationPlan.mode === 'full' && 'Full Regeneration'}
                  {result.regenerationPlan.mode === 'partial_reidentify' && 'Re-analyze & Partial'}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {result.regenerationPlan.reason}
              </p>
              {result.regenerationPlan.chaptersToRegenerate.length > 0 && (
                <div className="text-xs">
                  <span className="text-gray-500">Chapters to update: </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {result.regenerationPlan.chaptersToRegenerate.join(', ')}
                  </span>
                </div>
              )}
              {result.regenerationPlan.estimatedSavings > 0 && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  💰 Estimated savings: {result.regenerationPlan.estimatedSavings}% fewer API calls
                </p>
              )}
            </div>
          )}

          {/* Mode Selector */}
          {result.cached && (
            <div className="p-3 border rounded">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Regeneration Mode:
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleModeChange('auto')}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedMode === 'auto'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  🤖 Auto (Recommended)
                </button>
                <button
                  onClick={() => handleModeChange('skip')}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedMode === 'skip'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  ✅ Use Cache
                </button>
                <button
                  onClick={() => handleModeChange('partial')}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedMode === 'partial'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  🔄 Partial
                </button>
                <button
                  onClick={() => handleModeChange('full')}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedMode === 'full'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  🔨 Full
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click &quot;Check Cache&quot; to see if this repository has cached tutorial data.
        </p>
      )}
    </div>
  );
}

export default CacheStatusPreview;
