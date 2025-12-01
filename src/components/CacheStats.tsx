'use client';

import { useState, useEffect } from 'react';

interface CacheStatsData {
  totalCalls: number;
  hits: number;
  hitRate: string;
  misses?: {
    total: number;
    reasons?: {
      cacheDisabled: number;
      cacheEmpty: number;
      entryNotFound: number;
      modelMismatch: number;
      cacheError: number;
    };
  };
}

const defaultStats: CacheStatsData = {
  totalCalls: 0,
  hits: 0,
  hitRate: '0%',
  misses: {
    total: 0,
    reasons: {
      cacheDisabled: 0,
      cacheEmpty: 0,
      entryNotFound: 0,
      modelMismatch: 0,
      cacheError: 0
    }
  }
};

export function CacheStats() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<CacheStatsData>(defaultStats);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/llm/cache-stats');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch cache statistics');
      }
      
      const receivedStats = data.stats || {};
      setStats({
        ...defaultStats,
        ...receivedStats,
        misses: {
          ...defaultStats.misses,
          ...(receivedStats.misses || {}),
          reasons: {
            ...(defaultStats.misses?.reasons || {}),
            ...(receivedStats.misses?.reasons || {})
          }
        }
      });
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/llm/cache-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to reset cache statistics');
      }
      
      fetchStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const hitRateNum = parseFloat(stats?.hitRate || '0');
  const hitRateColor = hitRateNum >= 70 ? 'text-green-600' : hitRateNum >= 40 ? 'text-yellow-600' : 'text-red-500';

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Cache Error</span>
        </div>
        <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
        <button onClick={fetchStats} className="mt-2 text-sm text-red-600 hover:text-red-800 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border dark:border-gray-700 rounded-xl p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">LLM Cache</h3>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          <button 
            onClick={fetchStats}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Refresh"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.totalCalls || 0}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Requests</div>
        </div>
        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.hits || 0}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Cache Hits</div>
        </div>
        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className={`text-2xl font-bold ${hitRateColor}`}>{stats?.hitRate || '0%'}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Hit Rate</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-green-400 transition-all duration-500"
            style={{ width: stats?.hitRate || '0%' }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>Cache efficiency</span>
          <span>100%</span>
        </div>
      </div>

      {/* Expandable Details */}
      <div>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <svg 
            className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-90' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showDetails ? 'Hide details' : 'Show miss reasons'}
        </button>

        {showDetails && (
          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2 animate-in slide-in-from-top-2 duration-200">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cache Misses: {stats?.misses?.total || 0}
            </div>
            {[
              { label: 'Entry not found', value: stats?.misses?.reasons?.entryNotFound || 0, icon: '🔍' },
              { label: 'Model mismatch', value: stats?.misses?.reasons?.modelMismatch || 0, icon: '🔄' },
              { label: 'Cache disabled', value: stats?.misses?.reasons?.cacheDisabled || 0, icon: '⏸️' },
              { label: 'Cache empty', value: stats?.misses?.reasons?.cacheEmpty || 0, icon: '📭' },
              { label: 'Cache error', value: stats?.misses?.reasons?.cacheError || 0, icon: '⚠️' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <span>{item.icon}</span>
                  {item.label}
                </span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-4 pt-3 border-t dark:border-gray-700 flex justify-end">
        <button 
          onClick={resetStats}
          disabled={loading}
          className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
        >
          Reset Statistics
        </button>
      </div>
    </div>
  );
}