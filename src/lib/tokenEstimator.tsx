/**
 * Token Estimator
 * Estimates token count for prompts and provides warnings before LLM calls
 * 
 * Uses a simple heuristic: ~4 characters per token (English text)
 * More accurate for English, may vary for code or other languages
 */

import { getModel, getProvider } from './providers';
import { MODEL_CONTEXT_WINDOWS } from '@/lib/constants/llm';

// Average characters per token (conservative estimate)
const CHARS_PER_TOKEN = 3.5;

// Safety margin: reserve this percentage of context window for output
const OUTPUT_RESERVE_PERCENT = 0.15;

// Minimum output tokens to reserve
const MIN_OUTPUT_TOKENS = 4096;

export interface TokenEstimation {
  estimatedTokens: number;
  contextWindow: number;
  availableTokens: number;
  outputReserve: number;
  percentUsed: number;
  isOverLimit: boolean;
  warningLevel: 'safe' | 'warning' | 'danger' | 'critical';
  message: string;
  recommendations: string[];
}

export interface TokenLimitConfig {
  /** Custom context window override (tokens) */
  customContextWindow?: number;
  /** Custom output token reserve */
  outputReserve?: number;
  /** Whether to use strict mode (lower thresholds) */
  strictMode?: boolean;
}

/**
 * Estimate token count from text
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // Simple heuristic: chars / 3.5 (conservative for code which has more symbols)
  // This tends to slightly overestimate, which is safer
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for multiple files/strings
 */
export function estimateTokenCountBatch(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokenCount(text), 0);
}

/**
 * Get the context window for a model
 */
export function getModelContextWindow(providerId: string, modelId: string): number {
  // First check our constants
  const windowFromConstants = MODEL_CONTEXT_WINDOWS[modelId];
  if (windowFromConstants) return windowFromConstants;
  
  // Fall back to provider config
  const model = getModel(providerId, modelId);
  return model?.contextWindow || 8192; // Conservative default
}

/**
 * Get token estimation and warnings for a prompt
 */
export function estimateTokensWithWarning(
  prompt: string,
  providerId: string,
  modelId: string,
  config?: TokenLimitConfig
): TokenEstimation {
  const estimatedTokens = estimateTokenCount(prompt);
  const contextWindow = config?.customContextWindow || getModelContextWindow(providerId, modelId);
  
  // Calculate output reserve
  const outputReserve = config?.outputReserve || Math.max(
    MIN_OUTPUT_TOKENS,
    Math.floor(contextWindow * OUTPUT_RESERVE_PERCENT)
  );
  
  // Available tokens for input
  const availableTokens = contextWindow - outputReserve;
  const percentUsed = (estimatedTokens / availableTokens) * 100;
  const isOverLimit = estimatedTokens > availableTokens;
  
  // Determine warning level
  let warningLevel: TokenEstimation['warningLevel'];
  if (percentUsed > 100) {
    warningLevel = 'critical';
  } else if (percentUsed > 90) {
    warningLevel = 'danger';
  } else if (percentUsed > 75) {
    warningLevel = 'warning';
  } else {
    warningLevel = 'safe';
  }
  
  // Generate message and recommendations
  // Note: We use getProvider to validate the provider exists, even if we don't use all its properties
  getProvider(providerId);
  const model = getModel(providerId, modelId);
  const modelName = model?.name || modelId;
  
  let message: string;
  const recommendations: string[] = [];
  
  if (isOverLimit) {
    const overBy = estimatedTokens - availableTokens;
    message = `⚠️ Estimated ${estimatedTokens.toLocaleString()} tokens exceeds the ${modelName} limit of ${availableTokens.toLocaleString()} input tokens by ~${overBy.toLocaleString()} tokens.`;
    recommendations.push('Reduce the number of files selected');
    recommendations.push('Filter out large files or test files');
    recommendations.push('Use a model with a larger context window (e.g., Gemini with 1M+ tokens)');
    if (contextWindow < 200000) {
      recommendations.push(`Switch to a larger model - current limit is ${(contextWindow / 1000).toFixed(0)}K tokens`);
    }
  } else if (warningLevel === 'danger') {
    message = `🔶 Estimated ${estimatedTokens.toLocaleString()} tokens uses ${percentUsed.toFixed(1)}% of available context. You may hit limits during generation.`;
    recommendations.push('Consider reducing file count for more reliable results');
    recommendations.push('Large responses may be truncated');
  } else if (warningLevel === 'warning') {
    message = `📊 Estimated ${estimatedTokens.toLocaleString()} tokens (${percentUsed.toFixed(1)}% of ${modelName} context window)`;
  } else {
    message = `✅ Estimated ${estimatedTokens.toLocaleString()} tokens (${percentUsed.toFixed(1)}% of available context)`;
  }
  
  return {
    estimatedTokens,
    contextWindow,
    availableTokens,
    outputReserve,
    percentUsed,
    isOverLimit,
    warningLevel,
    message,
    recommendations,
  };
}

/**
 * Estimate tokens for files content
 */
export function estimateTokensForFiles(
  files: Array<{ path: string; content: string } | [string, string]>,
  providerId: string,
  modelId: string,
  config?: TokenLimitConfig
): TokenEstimation & { fileBreakdown: Array<{ path: string; tokens: number }> } {
  // Normalize file format
  const normalizedFiles = files.map(f => {
    if (Array.isArray(f)) {
      return { path: f[0], content: f[1] };
    }
    return f;
  });
  
  // Calculate per-file token estimates
  const fileBreakdown = normalizedFiles.map(f => ({
    path: f.path,
    tokens: estimateTokenCount(f.content),
  }));
  
  // Sort by token count descending for recommendations
  fileBreakdown.sort((a, b) => b.tokens - a.tokens);
  
  // Combined content for total estimation
  const combinedContent = normalizedFiles.map(f => `File: ${f.path}\n${f.content}`).join('\n\n');
  
  // Get base estimation
  const baseEstimation = estimateTokensWithWarning(combinedContent, providerId, modelId, config);
  
  // Add file-specific recommendations if over limit
  if (baseEstimation.isOverLimit) {
    const topFiles = fileBreakdown.slice(0, 3);
    const topFilesTokens = topFiles.reduce((sum, f) => sum + f.tokens, 0);
    
    if (topFilesTokens > baseEstimation.estimatedTokens * 0.5) {
      baseEstimation.recommendations.unshift(
        `Largest files: ${topFiles.map(f => `${f.path} (${f.tokens.toLocaleString()} tokens)`).join(', ')}`
      );
    }
  }
  
  return {
    ...baseEstimation,
    fileBreakdown,
  };
}

/**
 * Parse token limit error from API response
 */
export function parseTokenLimitError(error: string | Error): {
  isTokenLimitError: boolean;
  requestedTokens?: number;
  limitTokens?: number;
  message: string;
} {
  const errorMessage = error instanceof Error ? error.message : error;
  
  // Pattern: "Input tokens exceed the configured limit of X tokens. Your messages resulted in Y tokens."
  const pattern1 = /Input tokens exceed the configured limit of (\d+) tokens.*resulted in (\d+) tokens/i;
  // Pattern: "maximum context length is X tokens" / "Y tokens in your prompt"
  const pattern2 = /maximum context length is (\d+) tokens.*?(\d+) tokens/i;
  // Pattern: "context_length_exceeded"
  const pattern3 = /context_length_exceeded/i;
  // Pattern: "Request too large"
  const pattern4 = /request too large|payload too large/i;
  
  let match = errorMessage.match(pattern1);
  if (match) {
    return {
      isTokenLimitError: true,
      limitTokens: parseInt(match[1], 10),
      requestedTokens: parseInt(match[2], 10),
      message: `Input (${parseInt(match[2], 10).toLocaleString()} tokens) exceeds limit (${parseInt(match[1], 10).toLocaleString()} tokens)`,
    };
  }
  
  match = errorMessage.match(pattern2);
  if (match) {
    return {
      isTokenLimitError: true,
      limitTokens: parseInt(match[1], 10),
      requestedTokens: parseInt(match[2], 10),
      message: `Prompt (${parseInt(match[2], 10).toLocaleString()} tokens) exceeds context window (${parseInt(match[1], 10).toLocaleString()} tokens)`,
    };
  }
  
  if (pattern3.test(errorMessage) || pattern4.test(errorMessage)) {
    return {
      isTokenLimitError: true,
      message: 'Token limit exceeded',
    };
  }
  
  return {
    isTokenLimitError: false,
    message: errorMessage,
  };
}

/**
 * Calculate how much content to reduce to fit within limit
 */
export function calculateContentReduction(
  currentTokens: number,
  limitTokens: number,
  safetyMargin: number = 0.9 // Target 90% of limit
): {
  targetTokens: number;
  reductionPercent: number;
  filesToRemove: number; // Estimated files to remove (assuming avg 1000 tokens/file)
} {
  const targetTokens = Math.floor(limitTokens * safetyMargin);
  const tokensToReduce = currentTokens - targetTokens;
  const reductionPercent = (tokensToReduce / currentTokens) * 100;
  
  // Rough estimate: assume average file is ~1000 tokens
  const avgTokensPerFile = 1000;
  const filesToRemove = Math.ceil(tokensToReduce / avgTokensPerFile);
  
  return {
    targetTokens,
    reductionPercent,
    filesToRemove,
  };
}

/**
 * Suggest alternative models with larger context windows
 */
export function suggestLargerModels(
  currentProviderId: string,
  currentModelId: string,
  requiredTokens: number
): Array<{ providerId: string; modelId: string; name: string; contextWindow: number }> {
  const suggestions: Array<{ providerId: string; modelId: string; name: string; contextWindow: number }> = [];
  
  // Check all models in constants
  for (const [modelId, contextWindow] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
    if (contextWindow >= requiredTokens && modelId !== currentModelId) {
      // Determine provider from model ID patterns
      let providerId = 'unknown';
      let providerName = 'Unknown';
      
      if (modelId.includes('gpt') || modelId.startsWith('o1') || modelId.startsWith('o3') || modelId.startsWith('o4')) {
        providerId = 'openai';
        providerName = 'OpenAI';
      } else if (modelId.includes('claude')) {
        providerId = 'anthropic';
        providerName = 'Anthropic';
      } else if (modelId.includes('gemini')) {
        providerId = 'google';
        providerName = 'Google';
      } else if (modelId.includes('llama') || modelId.includes('mixtral') || modelId.includes('qwen')) {
        providerId = 'groq';
        providerName = 'Groq';
      } else if (modelId.includes('deepseek')) {
        providerId = 'deepseek';
        providerName = 'DeepSeek';
      } else if (modelId.includes('grok')) {
        providerId = 'xai';
        providerName = 'xAI';
      }
      
      const model = getModel(providerId, modelId);
      suggestions.push({
        providerId,
        modelId,
        name: model?.name || `${providerName} ${modelId}`,
        contextWindow,
      });
    }
  }
  
  // Sort by context window size (prefer smaller ones that still fit)
  return suggestions
    .sort((a, b) => a.contextWindow - b.contextWindow)
    .slice(0, 5); // Top 5 suggestions
}
