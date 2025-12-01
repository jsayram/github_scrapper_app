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

// Default empty stats object to prevent null/undefined errors
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

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/llm/cache-stats');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch cache statistics');
      }
      
      // Make sure we have a valid stats object, merge with default values if needed
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
      
      // Refetch stats after reset
      fetchStats();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Set up polling to refresh stats periodically
    const interval = setInterval(fetchStats, 10000); // refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <div className="p-4">Loading cache statistics...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-500">Error: {error}</div>;
  }

  if (!stats) {
    return <div className="p-4">No cache statistics available</div>;
  }

  return (
    <div className="p-4 border rounded-lg shadow-sm max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <h3 className="text-lg font-medium mb-4 sticky top-0 bg-white dark:bg-gray-900 pb-2">LLM Cache Statistics</h3>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-500">Total Requests</div>
          <div className="text-xl font-semibold">{stats?.totalCalls || 0}</div>
        </div>
        <div className="p-3 bg-green-50 rounded">
          <div className="text-sm text-gray-500">Cache Hit Rate</div>
          <div className="text-xl font-semibold">{stats?.hitRate || '0%'}</div>
        </div>
        <div className="p-3 bg-green-50 rounded">
          <div className="text-sm text-gray-500">Cache Hits</div>
          <div className="text-xl font-semibold">{stats?.hits || 0}</div>
        </div>
        <div className="p-3 bg-red-50 rounded">
          <div className="text-sm text-gray-500">Cache Misses</div>
          <div className="text-xl font-semibold">{stats?.misses?.total || 0}</div>
        </div>
      </div>

      <div className="mb-4">
        <h4 className="text-md font-medium mb-2">Cache Miss Reasons:</h4>
        <ul className="text-sm max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
          <li className="flex justify-between py-1">
            <span>Cache disabled:</span> 
            <span className="font-medium">{stats?.misses?.reasons?.cacheDisabled || 0}</span>
          </li>
          <li className="flex justify-between py-1">
            <span>Cache entry not found:</span> 
            <span className="font-medium">{stats?.misses?.reasons?.entryNotFound || 0}</span>
          </li>
          <li className="flex justify-between py-1">
            <span>Model mismatch:</span> 
            <span className="font-medium">{stats?.misses?.reasons?.modelMismatch || 0}</span>
          </li>
          <li className="flex justify-between py-1">
            <span>Cache error:</span> 
            <span className="font-medium">{stats?.misses?.reasons?.cacheError || 0}</span>
          </li>
          <li className="flex justify-between py-1">
            <span>Cache empty:</span> 
            <span className="font-medium">{stats?.misses?.reasons?.cacheEmpty || 0}</span>
          </li>
        </ul>
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={fetchStats}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
        >
          Refresh
        </button>
        <button 
          onClick={resetStats}
          className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-sm"
        >
          Reset Stats
        </button>
      </div>
    </div>
  );
}