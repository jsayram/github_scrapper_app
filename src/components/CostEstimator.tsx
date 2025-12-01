'use client';

/**
 * Cost Estimator Component
 * Displays estimated costs before generation with ±20% range
 */

import React, { useState, useEffect } from 'react';
import { type CostEstimate } from '@/lib/costEstimator';
import { MODEL_CONTEXT_WINDOWS } from '@/lib/constants/llm';

interface CostEstimatorProps {
  providerId: string;
  modelId: string;
  fileCount: number;
  totalChars: number;
  estimatedChapters?: number;
  className?: string;
}

export function CostEstimator({
  providerId,
  modelId,
  fileCount,
  totalChars,
  estimatedChapters = 8,
  className = '',
}: CostEstimatorProps) {
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = useState<boolean>(false);

  useEffect(() => {
    if (!providerId || !modelId || totalChars === 0) {
      setEstimate(null);
      return;
    }

    const fetchEstimate = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/estimate-cost', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerId,
            modelId,
            totalChars,
            fileCount,
            estimatedChapters,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to estimate cost');
        }

        const data = await response.json();
        setEstimate(data);
      } catch (err) {
        setError('Failed to estimate cost');
        console.error('Cost estimation error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEstimate();
  }, [providerId, modelId, totalChars, fileCount, estimatedChapters]);

  if (!providerId || !modelId || totalChars === 0) {
    return null;
  }

  if (loading) {
    return (
      <div className={`p-4 bg-gray-50 dark:bg-gray-800 rounded-lg ${className}`}>
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Estimating cost...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 bg-red-50 dark:bg-red-900/20 rounded-lg ${className}`}>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (!estimate) {
    return null;
  }

  return (
    <div className={`p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
            💰 Estimated Cost
            {estimate.isFree && (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-0.5 rounded-full">
                FREE
              </span>
            )}
          </h3>
          
          <div className="mt-2">
            {estimate.isFree ? (
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                $0.00
              </p>
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {estimate.formattedCost}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Using {estimate.provider} / {estimate.model}
            </p>
          </div>
        </div>

        <div className="text-right text-sm">
          <div className="text-gray-500 dark:text-gray-400">
            <div>~{(estimate.tokens.inputTokens / 1000).toFixed(1)}k input tokens</div>
            <div>~{(estimate.tokens.outputTokens / 1000).toFixed(1)}k output tokens</div>
          </div>
        </div>
      </div>

      {/* Token Breakdown Toggle */}
      <button
        type="button"
        onClick={() => setShowBreakdown(!showBreakdown)}
        className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
      >
        {showBreakdown ? '▼' : '▶'} {showBreakdown ? 'Hide' : 'Show'} breakdown
      </button>

      {/* Token Breakdown */}
      {showBreakdown && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-gray-500 dark:text-gray-400">File content:</div>
            <div className="text-right text-gray-700 dark:text-gray-300">
              ~{(estimate.tokens.breakdown.fileContent / 1000).toFixed(1)}k tokens
            </div>
            
            <div className="text-gray-500 dark:text-gray-400">Abstraction identification:</div>
            <div className="text-right text-gray-700 dark:text-gray-300">
              ~{(estimate.tokens.breakdown.abstractionPrompts / 1000).toFixed(1)}k tokens
            </div>
            
            <div className="text-gray-500 dark:text-gray-400">Relationship analysis:</div>
            <div className="text-right text-gray-700 dark:text-gray-300">
              ~{(estimate.tokens.breakdown.relationshipPrompts / 1000).toFixed(1)}k tokens
            </div>
            
            <div className="text-gray-500 dark:text-gray-400">Chapter ordering:</div>
            <div className="text-right text-gray-700 dark:text-gray-300">
              ~{(estimate.tokens.breakdown.orderingPrompts / 1000).toFixed(1)}k tokens
            </div>
            
            <div className="text-gray-500 dark:text-gray-400">Chapter writing ({estimatedChapters} chapters):</div>
            <div className="text-right text-gray-700 dark:text-gray-300">
              ~{(estimate.tokens.breakdown.chapterPrompts / 1000).toFixed(1)}k tokens
            </div>
          </div>
        </div>
      )}

      {/* Cost Warning */}
      {!estimate.isFree && estimate.costEstimated > 1 && (
        <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
          ⚠️ This is a larger repo. Consider using a more cost-effective model like 
          Groq Llama 3.3 or local Ollama to reduce costs.
        </div>
      )}
      
      {/* Token Limit Warning */}
      {(() => {
        // Check if input tokens might exceed context window
        const contextWindow = MODEL_CONTEXT_WINDOWS[modelId] || 128000;
        const inputTokens = estimate.tokens.inputTokens;
        const percentUsed = (inputTokens / contextWindow) * 100;
        
        if (percentUsed > 90) {
          return (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-300">
              🚨 <strong>Token limit warning:</strong> Input tokens (~{(inputTokens / 1000).toFixed(0)}k) 
              are at {percentUsed.toFixed(0)}% of the {modelId} context window ({(contextWindow / 1000).toFixed(0)}k).
              {percentUsed > 100 
                ? ' You may encounter token limit errors. Consider selecting fewer files or using a model with a larger context window (e.g., Gemini 2.5 Flash with 1M tokens).'
                : ' Generation may fail. Consider reducing file count or using a larger model.'}
            </div>
          );
        } else if (percentUsed > 70) {
          return (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-700 dark:text-yellow-300">
              ⚠️ <strong>Token usage high:</strong> Input tokens (~{(inputTokens / 1000).toFixed(0)}k) 
              are at {percentUsed.toFixed(0)}% of available context. Large outputs may be truncated.
            </div>
          );
        }
        return null;
      })()}

      {/* Free Tip */}
      {!estimate.isFree && (
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          💡 Tip: Use Ollama (local) or Groq for free/cheap generation
        </p>
      )}
    </div>
  );
}

export default CostEstimator;
