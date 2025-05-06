import { CacheStats } from '@/components/CacheStats';

export default function CacheStatsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">LLM Cache Statistics</h1>
      <p className="mb-4 text-gray-600">
        This page shows detailed statistics about the LLM cache utilization.
        Understanding why cache misses occur can help you optimize your API usage.
      </p>
      
      <div className="my-6">
        <CacheStats />
      </div>
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Tips to Improve Cache Hit Rate</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>Ensure <code className="bg-gray-100 px-1 rounded">useCache</code> parameter is set to <code className="bg-gray-100 px-1 rounded">true</code> (default) in all LLM calls</li>
          <li>Use consistent prompts for similar queries to benefit from the prompt normalization</li>
          <li>Check for "Model mismatch" errors - consider standardizing on one model for similar queries</li>
          <li>If you see many "Cache errors", check your file system permissions</li>
        </ul>
      </div>
    </div>
  );
}