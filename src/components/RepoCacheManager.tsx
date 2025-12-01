'use client';

/**
 * Repository Cache Manager Component
 * Displays repo cache statistics and provides cleanup controls
 */

import React, { useState, useEffect, useCallback } from 'react';

interface RepoStats {
  repoId: string;
  repoUrl: string;
  sizeMB: number;
  lastAccessed: string;
  ageInDays: number;
  chapterCount: number;
}

interface CacheStatsResponse {
  success: boolean;
  stats?: {
    totalRepos: number;
    totalSizeMB: number;
    oldestEntry: string | null;
    newestEntry: string | null;
    repos: RepoStats[];
  };
  error?: string;
}

interface CleanupResult {
  deletedRepos: number;
  deletedFiles: number;
  freedSpaceMB: number;
  remainingRepos: number;
  remainingSizeMB: number;
  errors: string[];
}

export function RepoCacheManager() {
  const [stats, setStats] = useState<CacheStatsResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cache/repo-stats');
      const data: CacheStatsResponse = await response.json();
      
      if (!data.success || !data.stats) {
        throw new Error(data.error || 'Failed to fetch cache stats');
      }
      
      setStats(data.stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleCleanup = async (action: string, config?: Record<string, unknown>) => {
    try {
      setIsCleaningUp(true);
      setCleanupResult(null);
      
      const response = await fetch('/api/cache/repo-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, config }),
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Cleanup failed');
      }
      
      if (data.result) {
        setCleanupResult(data.result);
      }
      
      // Refresh stats after cleanup
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setIsCleaningUp(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading && !stats) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading cache statistics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white dark:bg-gray-900 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          📦 Repository Cache
        </h3>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {cleanupResult && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm">
          <p className="font-medium text-green-700 dark:text-green-300">Cleanup Complete!</p>
          <ul className="mt-1 text-green-600 dark:text-green-400">
            <li>Deleted {cleanupResult.deletedRepos} repo(s)</li>
            <li>Freed {cleanupResult.freedSpaceMB.toFixed(2)} MB</li>
            <li>Remaining: {cleanupResult.remainingRepos} repos ({cleanupResult.remainingSizeMB.toFixed(2)} MB)</li>
          </ul>
          {cleanupResult.errors.length > 0 && (
            <p className="mt-2 text-red-600 dark:text-red-400">
              Errors: {cleanupResult.errors.join(', ')}
            </p>
          )}
        </div>
      )}

      {stats && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Repos</div>
              <div className="text-xl font-semibold">{stats.totalRepos}</div>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Size</div>
              <div className="text-xl font-semibold">{stats.totalSizeMB.toFixed(2)} MB</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Oldest</div>
              <div className="text-sm font-medium truncate">
                {stats.oldestEntry ? formatDate(stats.oldestEntry) : 'N/A'}
              </div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="text-xs text-gray-500 dark:text-gray-400">Newest</div>
              <div className="text-sm font-medium truncate">
                {stats.newestEntry ? formatDate(stats.newestEntry) : 'N/A'}
              </div>
            </div>
          </div>

          {/* Repo List */}
          {stats.repos.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-medium mb-2">Cached Repositories</h4>
              <div className="max-h-48 overflow-y-auto border rounded dark:border-gray-700">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left">Repository</th>
                      <th className="px-3 py-2 text-right">Size</th>
                      <th className="px-3 py-2 text-right">Chapters</th>
                      <th className="px-3 py-2 text-right">Age</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {stats.repos.map((repo) => (
                      <tr key={repo.repoId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-3 py-2 truncate max-w-[200px]" title={repo.repoUrl}>
                          {repo.repoId}
                        </td>
                        <td className="px-3 py-2 text-right">{repo.sizeMB.toFixed(2)} MB</td>
                        <td className="px-3 py-2 text-right">{repo.chapterCount}</td>
                        <td className="px-3 py-2 text-right">{repo.ageInDays}d</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cleanup Actions */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCleanup('cleanup')}
                disabled={isCleaningUp}
                className="px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 transition-colors"
              >
                {isCleaningUp ? 'Cleaning...' : '🧹 Auto Cleanup'}
              </button>
              
              <button
                onClick={() => handleCleanup('cleanup-orphans')}
                disabled={isCleaningUp}
                className="px-3 py-1.5 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded disabled:opacity-50 transition-colors"
              >
                🗑️ Clean Orphans
              </button>
              
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded transition-colors"
              >
                ⚙️ Advanced
              </button>
            </div>
            
            {showAdvanced && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                  ⚠️ Danger Zone
                </p>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to clear ALL cache? This cannot be undone.')) {
                      handleCleanup('clear-all');
                    }
                  }}
                  disabled={isCleaningUp}
                  className="px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 transition-colors"
                >
                  🗑️ Clear All Cache
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {!stats && !loading && !error && (
        <p className="text-gray-500 dark:text-gray-400 text-sm">No cache data available</p>
      )}
    </div>
  );
}

export default RepoCacheManager;
