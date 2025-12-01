import { CacheStats } from '@/components/CacheStats';
import { RepoCacheManager } from '@/components/RepoCacheManager';

export default function CacheStatsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Cache Management</h1>
      <p className="mb-4 text-gray-600 dark:text-gray-400">
        Monitor and manage caches to optimize API usage and storage.
      </p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* LLM Cache Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-3">🤖 LLM Prompt Cache</h2>
          <CacheStats />
        </div>
        
        {/* Repo Cache Stats */}
        <div>
          <h2 className="text-lg font-semibold mb-3">📦 Repository Cache</h2>
          <RepoCacheManager />
        </div>
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Tips to Improve Cache Hit Rate</h2>
        <ul className="list-disc pl-5 space-y-2 text-gray-700 dark:text-gray-300">
          <li>Ensure <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">useCache</code> parameter is set to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">true</code> (default) in all LLM calls</li>
          <li>Use consistent prompts for similar queries to benefit from prompt normalization</li>
          <li>Repository cache stores abstractions and chapters - regenerating the same repo will use cached data</li>
          <li>Partial regeneration only updates chapters affected by file changes</li>
          <li>Check for &quot;Model mismatch&quot; errors - consider standardizing on one model for similar queries</li>
        </ul>
      </div>
      
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Cache Types Explained</h2>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium">LLM Prompt Cache</dt>
            <dd className="text-gray-600 dark:text-gray-400 ml-4">
              Stores LLM responses keyed by normalized prompts. Supports fuzzy matching for similar prompts.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Repository Cache</dt>
            <dd className="text-gray-600 dark:text-gray-400 ml-4">
              Stores repository data including file hashes, identified abstractions, and generated chapters. 
              Enables partial regeneration when files change.
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}