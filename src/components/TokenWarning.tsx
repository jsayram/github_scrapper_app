'use client';

/**
 * Token Warning Component
 * Displays token usage warnings before LLM generation
 * Allows users to adjust token limits and see recommendations
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  estimateTokensForFiles,
  suggestLargerModels,
} from '@/lib/tokenEstimator';

interface TokenWarningProps {
  /** Files to estimate tokens for */
  files: Array<{ path: string; content: string } | [string, string]>;
  /** Current LLM provider ID */
  providerId: string;
  /** Current model ID */
  modelId: string;
  /** Callback when user changes token limit */
  onTokenLimitChange?: (newLimit: number) => void;
  /** Callback when user wants to change model */
  onModelSuggestionClick?: (providerId: string, modelId: string) => void;
  /** Custom context window override */
  customContextWindow?: number;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function TokenWarning({
  files,
  providerId,
  modelId,
  onTokenLimitChange,
  onModelSuggestionClick,
  customContextWindow,
  showBreakdown = false,
  className = '',
}: TokenWarningProps) {
  const [showDetails, setShowDetails] = useState(showBreakdown);
  const [showLimitEditor, setShowLimitEditor] = useState(false);
  const [customLimit, setCustomLimit] = useState<string>('');
  
  // Calculate token estimation
  const estimation = useMemo(() => {
    if (!files.length) return null;
    return estimateTokensForFiles(files, providerId, modelId, {
      customContextWindow,
    });
  }, [files, providerId, modelId, customContextWindow]);
  
  // Get model suggestions if over limit
  const suggestions = useMemo(() => {
    if (!estimation?.isOverLimit) return [];
    return suggestLargerModels(providerId, modelId, estimation.estimatedTokens);
  }, [estimation, providerId, modelId]);
  
  // Initialize custom limit input
  useEffect(() => {
    if (estimation?.contextWindow) {
      setCustomLimit(estimation.contextWindow.toString());
    }
  }, [estimation?.contextWindow]);
  
  if (!estimation) {
    return null;
  }
  
  const {
    estimatedTokens,
    contextWindow,
    availableTokens,
    percentUsed,
    isOverLimit,
    warningLevel,
    message,
    recommendations,
    fileBreakdown,
  } = estimation;
  
  // Color scheme based on warning level
  const colorSchemes = {
    safe: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-800 dark:text-green-200',
      progressBg: 'bg-green-100 dark:bg-green-900/30',
      progressFill: 'bg-green-500',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      border: 'border-yellow-200 dark:border-yellow-800',
      text: 'text-yellow-800 dark:text-yellow-200',
      progressBg: 'bg-yellow-100 dark:bg-yellow-900/30',
      progressFill: 'bg-yellow-500',
    },
    danger: {
      bg: 'bg-orange-50 dark:bg-orange-900/20',
      border: 'border-orange-200 dark:border-orange-800',
      text: 'text-orange-800 dark:text-orange-200',
      progressBg: 'bg-orange-100 dark:bg-orange-900/30',
      progressFill: 'bg-orange-500',
    },
    critical: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      progressBg: 'bg-red-100 dark:bg-red-900/30',
      progressFill: 'bg-red-500',
    },
  };
  
  const colors = colorSchemes[warningLevel];
  
  const handleLimitSave = () => {
    const newLimit = parseInt(customLimit, 10);
    if (!isNaN(newLimit) && newLimit > 0 && onTokenLimitChange) {
      onTokenLimitChange(newLimit);
      setShowLimitEditor(false);
    }
  };
  
  return (
    <div className={`rounded-lg border p-4 ${colors.bg} ${colors.border} ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className={`font-medium ${colors.text}`}>{message}</p>
          
          {/* Progress bar */}
          <div className={`mt-2 h-2 rounded-full ${colors.progressBg} overflow-hidden`}>
            <div
              className={`h-full ${colors.progressFill} transition-all duration-300`}
              style={{ width: `${Math.min(percentUsed, 100)}%` }}
            />
          </div>
          
          <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{estimatedTokens.toLocaleString()} tokens</span>
            <span>{availableTokens.toLocaleString()} available</span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {onTokenLimitChange && (
            <button
              onClick={() => setShowLimitEditor(!showLimitEditor)}
              className="text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
            >
              Adjust limit
            </button>
          )}
        </div>
      </div>
      
      {/* Recommendations */}
      {isOverLimit && recommendations.length > 0 && (
        <div className="mt-3 space-y-1">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Recommendations:</p>
          <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
            {recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Model suggestions */}
      {isOverLimit && suggestions.length > 0 && onModelSuggestionClick && (
        <div className="mt-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Try a larger model:
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {suggestions.slice(0, 3).map((suggestion) => (
              <button
                key={`${suggestion.providerId}-${suggestion.modelId}`}
                onClick={() => onModelSuggestionClick(suggestion.providerId, suggestion.modelId)}
                className="text-xs px-2 py-1 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                {suggestion.name} ({(suggestion.contextWindow / 1000).toFixed(0)}K)
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Token limit editor */}
      {showLimitEditor && (
        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Custom Token Limit
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Set a custom context window size. Default for {modelId} is {contextWindow.toLocaleString()} tokens.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              value={customLimit}
              onChange={(e) => setCustomLimit(e.target.value)}
              className="flex-1 px-2 py-1 text-sm border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="Token limit"
              min={1000}
              step={1000}
            />
            <button
              onClick={handleLimitSave}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setCustomLimit(contextWindow.toString());
                setShowLimitEditor(false);
              }}
              className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
            >
              Cancel
            </button>
          </div>
          <div className="mt-2 flex gap-2 flex-wrap">
            {[128000, 200000, 500000, 1000000].map((preset) => (
              <button
                key={preset}
                onClick={() => setCustomLimit(preset.toString())}
                className={`text-xs px-2 py-1 rounded ${
                  customLimit === preset.toString()
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {(preset / 1000).toFixed(0)}K
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* File breakdown */}
      {showDetails && fileBreakdown && (
        <div className="mt-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Token breakdown by file (top 10):
          </p>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {fileBreakdown.slice(0, 10).map((file, idx) => {
              const filePercent = (file.tokens / estimatedTokens) * 100;
              return (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <div className="flex-1 truncate text-gray-600 dark:text-gray-400">
                    {file.path}
                  </div>
                  <div className="text-gray-500 dark:text-gray-500 tabular-nums">
                    {file.tokens.toLocaleString()}
                  </div>
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{ width: `${filePercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {fileBreakdown.length > 10 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                +{fileBreakdown.length - 10} more files
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact inline token indicator
 */
interface TokenIndicatorProps {
  estimatedTokens: number;
  contextWindow: number;
  className?: string;
}

export function TokenIndicator({ estimatedTokens, contextWindow, className = '' }: TokenIndicatorProps) {
  const percentUsed = (estimatedTokens / contextWindow) * 100;
  
  let colorClass = 'text-green-600 dark:text-green-400';
  if (percentUsed > 100) {
    colorClass = 'text-red-600 dark:text-red-400';
  } else if (percentUsed > 90) {
    colorClass = 'text-orange-600 dark:text-orange-400';
  } else if (percentUsed > 75) {
    colorClass = 'text-yellow-600 dark:text-yellow-400';
  }
  
  return (
    <span className={`text-sm font-mono ${colorClass} ${className}`}>
      {estimatedTokens.toLocaleString()} / {contextWindow.toLocaleString()} tokens
      ({percentUsed.toFixed(1)}%)
    </span>
  );
}

/**
 * Token limit error display with self-healing suggestions
 */
interface TokenLimitErrorProps {
  error: string;
  providerId: string;
  modelId: string;
  onRetryWithReduction?: () => void;
  onModelChange?: (providerId: string, modelId: string) => void;
  className?: string;
}

export function TokenLimitError({
  error,
  providerId,
  modelId,
  onRetryWithReduction,
  onModelChange,
  className = '',
}: TokenLimitErrorProps) {
  // Parse the error to extract token counts
  const limitMatch = error.match(/limit of (\d+) tokens/i);
  const requestedMatch = error.match(/resulted in (\d+) tokens/i);
  
  const limitTokens = limitMatch ? parseInt(limitMatch[1], 10) : null;
  const requestedTokens = requestedMatch ? parseInt(requestedMatch[1], 10) : null;
  
  // Get suggestions for larger models
  const suggestions = requestedTokens
    ? suggestLargerModels(providerId, modelId, requestedTokens)
    : [];
  
  const reductionNeeded = limitTokens && requestedTokens
    ? Math.ceil(((requestedTokens - limitTokens) / requestedTokens) * 100)
    : null;
  
  return (
    <div className={`rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">🚨</span>
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 dark:text-red-200">
            Token Limit Exceeded
          </h3>
          
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
          
          {requestedTokens && limitTokens && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              <p>
                <strong>Requested:</strong> {requestedTokens.toLocaleString()} tokens
              </p>
              <p>
                <strong>Limit:</strong> {limitTokens.toLocaleString()} tokens
              </p>
              <p>
                <strong>Reduction needed:</strong> ~{reductionNeeded}% of content
              </p>
            </div>
          )}
          
          {/* Actions */}
          <div className="mt-3 space-y-2">
            {onRetryWithReduction && (
              <button
                onClick={onRetryWithReduction}
                className="w-full px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-md hover:bg-orange-600 transition-colors"
              >
                🔄 Auto-reduce content & retry
              </button>
            )}
            
            {suggestions.length > 0 && onModelChange && (
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                  Or switch to a larger model:
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.slice(0, 3).map((s) => (
                    <button
                      key={`${s.providerId}-${s.modelId}`}
                      onClick={() => onModelChange(s.providerId, s.modelId)}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                      {s.name} ({(s.contextWindow / 1000).toFixed(0)}K)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TokenWarning;
