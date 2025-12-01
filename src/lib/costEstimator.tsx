/**
 * Cost Estimator
 * Estimates LLM API costs for tutorial generation based on repo size
 */

import { getProvider, getModel, type LLMModel } from './providers';

export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
  breakdown: {
    fileContent: number;
    abstractionPrompts: number;
    relationshipPrompts: number;
    chapterPrompts: number;
    orderingPrompts: number;
  };
}

export interface CostEstimate {
  provider: string;
  model: string;
  tokens: TokenEstimate;
  costLow: number;      // -20% estimate
  costEstimated: number; // Base estimate
  costHigh: number;     // +20% estimate
  isFree: boolean;
  formattedCost: string;
}

// Average tokens per character (rough estimate)
const TOKENS_PER_CHAR = 0.25;

// Overhead multiplier for prompt templates
const PROMPT_OVERHEAD = 1.3;

// Average output tokens per prompt type
const OUTPUT_ESTIMATES = {
  abstraction: 2000,    // List of abstractions
  relationship: 1500,   // Dependency analysis
  ordering: 500,        // Chapter ordering
  chapter: 3000,        // Per chapter content
};

/**
 * Estimate tokens needed for a repo
 */
export function estimateTokens(
  fileContents: Array<{ path: string; content: string }>,
  estimatedChapters: number = 8
): TokenEstimate {
  // Calculate file content tokens
  const totalChars = fileContents.reduce((sum, f) => sum + f.content.length, 0);
  const fileContentTokens = Math.ceil(totalChars * TOKENS_PER_CHAR);
  
  // Input tokens for each phase
  const abstractionInputTokens = Math.ceil(fileContentTokens * PROMPT_OVERHEAD);
  const relationshipInputTokens = Math.ceil(fileContentTokens * 0.3 * PROMPT_OVERHEAD); // Uses summaries
  const orderingInputTokens = Math.ceil(2000 * PROMPT_OVERHEAD); // Fixed size prompt
  const chapterInputTokens = Math.ceil(fileContentTokens * 0.5 * PROMPT_OVERHEAD) * estimatedChapters;
  
  // Output tokens
  const abstractionOutputTokens = OUTPUT_ESTIMATES.abstraction;
  const relationshipOutputTokens = OUTPUT_ESTIMATES.relationship;
  const orderingOutputTokens = OUTPUT_ESTIMATES.ordering;
  const chapterOutputTokens = OUTPUT_ESTIMATES.chapter * estimatedChapters;
  
  const totalInputTokens = 
    abstractionInputTokens + 
    relationshipInputTokens + 
    orderingInputTokens + 
    chapterInputTokens;
    
  const totalOutputTokens = 
    abstractionOutputTokens + 
    relationshipOutputTokens + 
    orderingOutputTokens + 
    chapterOutputTokens;
  
  return {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    breakdown: {
      fileContent: fileContentTokens,
      abstractionPrompts: abstractionInputTokens + abstractionOutputTokens,
      relationshipPrompts: relationshipInputTokens + relationshipOutputTokens,
      chapterPrompts: chapterInputTokens + chapterOutputTokens,
      orderingPrompts: orderingInputTokens + orderingOutputTokens,
    }
  };
}

/**
 * Calculate cost for a specific model
 */
export function calculateCost(
  model: LLMModel,
  tokens: TokenEstimate
): { low: number; estimated: number; high: number } {
  const inputCost = (tokens.inputTokens / 1000) * model.costPer1kInput;
  const outputCost = (tokens.outputTokens / 1000) * model.costPer1kOutput;
  const baseCost = inputCost + outputCost;
  
  return {
    low: baseCost * 0.8,
    estimated: baseCost,
    high: baseCost * 1.2
  };
}

/**
 * Format cost for display
 */
export function formatCost(cost: { low: number; estimated: number; high: number }): string {
  if (cost.estimated === 0) {
    return 'FREE (local)';
  }
  
  const format = (n: number) => {
    if (n < 0.01) return `$${n.toFixed(4)}`;
    if (n < 1) return `$${n.toFixed(3)}`;
    return `$${n.toFixed(2)}`;
  };
  
  return `${format(cost.low)} - ${format(cost.high)}`;
}

/**
 * Get full cost estimate for a provider/model combination
 */
export function getFullCostEstimate(
  providerId: string,
  modelId: string,
  fileContents: Array<{ path: string; content: string }>,
  estimatedChapters: number = 8
): CostEstimate {
  const provider = getProvider(providerId);
  const model = getModel(providerId, modelId);
  
  if (!provider || !model) {
    throw new Error(`Unknown provider/model: ${providerId}/${modelId}`);
  }
  
  const tokens = estimateTokens(fileContents, estimatedChapters);
  const cost = calculateCost(model, tokens);
  const isFree = model.costPer1kInput === 0 && model.costPer1kOutput === 0;
  
  return {
    provider: provider.name,
    model: model.name,
    tokens,
    costLow: cost.low,
    costEstimated: cost.estimated,
    costHigh: cost.high,
    isFree,
    formattedCost: formatCost(cost)
  };
}

/**
 * Compare costs across all providers/models
 */
export function compareCosts(
  fileContents: Array<{ path: string; content: string }>,
  estimatedChapters: number = 8
): CostEstimate[] {
  const { LLM_PROVIDERS } = require('./providers');
  const estimates: CostEstimate[] = [];
  
  for (const provider of LLM_PROVIDERS) {
    for (const model of provider.models) {
      try {
        estimates.push(
          getFullCostEstimate(provider.id, model.id, fileContents, estimatedChapters)
        );
      } catch {
        // Skip invalid combinations
      }
    }
  }
  
  // Sort by estimated cost
  return estimates.sort((a, b) => a.costEstimated - b.costEstimated);
}

/**
 * Get cost savings from cache
 */
export function calculateCacheSavings(
  providerId: string,
  modelId: string,
  cachedPrompts: number,
  avgTokensPerPrompt: number = 2000
): { tokensSaved: number; costSaved: number } {
  const model = getModel(providerId, modelId);
  if (!model) {
    return { tokensSaved: 0, costSaved: 0 };
  }
  
  const tokensSaved = cachedPrompts * avgTokensPerPrompt;
  const costSaved = (tokensSaved / 1000) * ((model.costPer1kInput + model.costPer1kOutput) / 2);
  
  return { tokensSaved, costSaved };
}

/**
 * Estimate partial regeneration cost savings
 */
export function estimatePartialRegenerationSavings(
  fullEstimate: CostEstimate,
  chaptersToRegenerate: number,
  totalChapters: number,
  rerunAbstractions: boolean
): {
  originalCost: number;
  newCost: number;
  savings: number;
  savingsPercent: number;
} {
  // Calculate what portion of cost is from chapters
  const chapterPortion = fullEstimate.tokens.breakdown.chapterPrompts / 
    (fullEstimate.tokens.inputTokens + fullEstimate.tokens.outputTokens);
  
  const abstractionPortion = 
    (fullEstimate.tokens.breakdown.abstractionPrompts + fullEstimate.tokens.breakdown.relationshipPrompts) /
    (fullEstimate.tokens.inputTokens + fullEstimate.tokens.outputTokens);
  
  // Calculate new cost
  const chapterRatio = chaptersToRegenerate / totalChapters;
  const chapterCost = fullEstimate.costEstimated * chapterPortion * chapterRatio;
  const abstractionCost = rerunAbstractions 
    ? fullEstimate.costEstimated * abstractionPortion 
    : 0;
  const orderingCost = fullEstimate.costEstimated * 
    (fullEstimate.tokens.breakdown.orderingPrompts / (fullEstimate.tokens.inputTokens + fullEstimate.tokens.outputTokens));
  
  const newCost = chapterCost + abstractionCost + orderingCost;
  const savings = fullEstimate.costEstimated - newCost;
  
  return {
    originalCost: fullEstimate.costEstimated,
    newCost,
    savings,
    savingsPercent: (savings / fullEstimate.costEstimated) * 100
  };
}
