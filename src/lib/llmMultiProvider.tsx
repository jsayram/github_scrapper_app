/**
 * Multi-Provider LLM Library
 * Supports OpenAI, Anthropic, Google, Groq, DeepSeek, OpenRouter, xAI, Azure, and Ollama
 * 
 * Provider-specific requirements:
 * 
 * OpenAI:
 *   - GPT-5 series, GPT-4.1 series, GPT-4o series: Use max_completion_tokens (not max_tokens)
 *   - o4-mini, o3-mini, o1, o1-mini: Use max_completion_tokens, NO temperature support
 *   - gpt-4-turbo, gpt-4, gpt-3.5-turbo: Use max_tokens (legacy)
 * 
 * Anthropic:
 *   - Claude 4.5, Claude 3.5, Claude 3: Use max_tokens, supports temperature
 * 
 * Google (Gemini):
 *   - Gemini 3, 2.5, 2.0: Use maxOutputTokens in generationConfig
 * 
 * Groq/DeepSeek/OpenRouter/xAI/Azure/Ollama:
 *   - OpenAI-compatible: Use max_tokens
 */

import fs from 'fs/promises';
import path from 'path';
import { OpenAI } from 'openai';
import { 
  getProvider, 
  getModel, 
  getProviderBaseUrl, 
  getEnvVarNames,
  type ProviderConfig 
} from './providers';
import { cacheLog, createScopedLogger } from './cacheLogger';
import { 
  createCacheStore, 
  findMatchingEntry, 
  addCacheEntry, 
  type SmartCacheStore 
} from './smartCache';
import {
  PROVIDER_IDS,
  OPENAI_MODELS,
  type ProviderId,
} from '@/lib/constants/llm';

const log = createScopedLogger('LLM');

// Environmental variables and constants
const LOG_DIR = process.env.LOG_DIR || 'logs';
const CACHE_FILE = process.env.LLM_CACHE_FILE || 'llm_cache.json';
const DEFAULT_MODEL = process.env.OPEN_AI_MODEL || OPENAI_MODELS.GPT_4O_MINI;

// In-memory cache store (loaded from file)
let cacheStore: SmartCacheStore | null = null;

// Ensure logs directory exists
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // Ignore if directory already exists
  }
}

// Simple logging
async function logToFile(message: string): Promise<void> {
  try {
    await ensureDir(LOG_DIR);
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const logFile = path.join(LOG_DIR, `llm_calls_${today}.log`);
    await fs.appendFile(logFile, `${new Date().toISOString()} - ${message}\n`);
  } catch (error) {
    console.error('Error writing to log:', error);
  }
}

/**
 * Get API key for a specific provider
 */
export function getApiKey(providerId: string, customKey?: string): string {
  // If a custom key is provided, use it
  if (customKey && customKey.trim()) {
    return customKey.trim();
  }
  
  // Get env var names for this provider
  const envVarNames = getEnvVarNames(providerId);
  const provider = getProvider(providerId);
  const providerName = provider?.name || providerId;
  
  // Local providers don't need API keys
  if (provider?.isLocal) {
    return '';
  }
  
  // Also check generic OpenAI key as fallback for compatible providers
  const allCandidates = [
    ...envVarNames,
    'OPENAI_API_KEY',
    'OPEN_AI_API_KEY',
    'OPENAI_KEY',
  ];

  for (const key of allCandidates) {
    const value = process.env[key];
    if (value) {
      log.debug(`Using API key from ${key}`);
      return value;
    }
  }

  // Provide user-friendly error message
  const envVarHint = envVarNames[0] || 'OPENAI_API_KEY';
  throw new Error(
    `🔑 No API key configured for ${providerName}. ` +
    `Either enter an API key in the field above, or add ${envVarHint} to your .env.local file. ` +
    `You can also try a different provider that you have configured.`
  );
}

/**
 * Load cache from file
 */
async function loadCache(): Promise<SmartCacheStore> {
  if (cacheStore) {
    return cacheStore;
  }

  const cachePath = path.join(process.cwd(), CACHE_FILE);
  
  try {
    const exists = await fs.access(cachePath).then(() => true).catch(() => false);
    if (exists) {
      const data = await fs.readFile(cachePath, 'utf8');
      const parsed = JSON.parse(data);
      
      // Handle legacy cache format (simple key-value)
      if (!parsed.entries && !parsed.stats) {
        log.info('Migrating legacy cache format');
        cacheStore = createCacheStore();
        
        // Convert legacy entries
        for (const [prompt, response] of Object.entries(parsed)) {
          if (typeof response === 'string') {
            addCacheEntry(cacheStore, prompt, response, {
              provider: PROVIDER_IDS.OPENAI,
              model: 'unknown'
            });
          }
        }
        
        await saveCache();
      } else {
        cacheStore = parsed;
      }
      
      log.load('Cache loaded', { entries: Object.keys(cacheStore!.entries).length });
    }
  } catch (error) {
    log.warn('Failed to load cache, creating new one', { error });
  }

  if (!cacheStore) {
    cacheStore = createCacheStore();
  }

  return cacheStore;
}

/**
 * Save cache to file
 */
async function saveCache(): Promise<void> {
  if (!cacheStore) return;
  
  const cachePath = path.join(process.cwd(), CACHE_FILE);
  
  try {
    await fs.writeFile(cachePath, JSON.stringify(cacheStore, null, 2));
    log.save('Cache saved', { entries: Object.keys(cacheStore.entries).length });
  } catch (error) {
    log.error('Failed to save cache', { error });
  }
}

export interface CallLLMOptions {
  prompt: string;
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
  onCacheStatus?: (hit: boolean) => void;
  customApiKey?: string;
  customBaseUrl?: string;
}

export interface CallLLMResult {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  cost?: number;
  cached: boolean;
}

/**
 * Call LLM with Anthropic SDK
 */
async function callAnthropic(
  apiKey: string,
  model: string,
  prompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
  // Dynamic import to avoid loading if not needed
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  
  const client = new Anthropic({ apiKey });
  
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    messages: [{ role: 'user', content: prompt }]
  });
  
  const content = response.content[0]?.type === 'text' 
    ? response.content[0].text 
    : '';
  
  return {
    content,
    usage: {
      inputTokens: response.usage?.input_tokens || 0,
      outputTokens: response.usage?.output_tokens || 0
    }
  };
}

/**
 * Call LLM with Google Generative AI SDK
 */
async function callGoogle(
  apiKey: string,
  model: string,
  prompt: string,
  temperature: number,
  maxTokens: number
): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
  // Dynamic import
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelInstance = genAI.getGenerativeModel({ 
    model,
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    }
  });
  
  const result = await modelInstance.generateContent(prompt);
  const response = result.response;
  const content = response.text();
  
  // Try to get usage metadata if available
  const usageMetadata = response.usageMetadata;
  
  return {
    content,
    usage: {
      inputTokens: usageMetadata?.promptTokenCount || 0,
      outputTokens: usageMetadata?.candidatesTokenCount || 0
    }
  };
}

/**
 * Call LLM with OpenAI SDK (works for OpenAI, Groq, DeepSeek, OpenRouter, xAI, Azure, Ollama)
 */
async function callOpenAICompatible(
  apiKey: string,
  model: string,
  prompt: string,
  temperature: number,
  maxTokens: number,
  baseUrl?: string,
  extraHeaders?: Record<string, string>,
  providerId?: string
): Promise<{ content: string; usage?: { inputTokens: number; outputTokens: number } }> {
  const clientConfig: ConstructorParameters<typeof OpenAI>[0] = { apiKey };
  
  if (baseUrl) {
    clientConfig.baseURL = baseUrl;
  }
  
  if (extraHeaders) {
    clientConfig.defaultHeaders = extraHeaders;
  }
  
  const client = new OpenAI(clientConfig);
  
  // Determine if this model needs max_completion_tokens vs max_tokens
  // OpenAI's newer models (GPT-5, GPT-4.1, GPT-4o, o-series) require max_completion_tokens
  const isNewerOpenAIModel = providerId === PROVIDER_IDS.OPENAI && (
    model.startsWith('gpt-5') ||
    model.startsWith('gpt-4.1') ||
    model.startsWith('gpt-4o') ||
    model.startsWith('o1') ||
    model.startsWith('o3') ||
    model.startsWith('o4')
  );
  
  // Reasoning models (o-series) don't support temperature parameter
  const isReasoningModel = model.startsWith('o1') || model.startsWith('o3') || model.startsWith('o4');
  
  // Build the request parameters
  const requestParams: Parameters<typeof client.chat.completions.create>[0] = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };
  
  // Add temperature only for models that support it
  if (!isReasoningModel) {
    requestParams.temperature = temperature;
  }
  
  // Use the correct token limit parameter based on model
  if (isNewerOpenAIModel) {
    requestParams.max_completion_tokens = maxTokens;
  } else {
    requestParams.max_tokens = maxTokens;
  }
  
  const response = await client.chat.completions.create(requestParams);
  
  return {
    content: response.choices[0]?.message?.content || '',
    usage: {
      inputTokens: response.usage?.prompt_tokens || 0,
      outputTokens: response.usage?.completion_tokens || 0
    }
  };
}

/**
 * Calculate cost based on provider/model and token usage
 */
function calculateCost(
  providerId: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getModel(providerId, modelId);
  if (!model) return 0;
  
  const inputCost = (inputTokens / 1000) * model.costPer1kInput;
  const outputCost = (outputTokens / 1000) * model.costPer1kOutput;
  
  return inputCost + outputCost;
}

/**
 * Main LLM call function with multi-provider support
 */
export async function callLLM({
  prompt,
  provider: providerId = PROVIDER_IDS.OPENAI,
  model: modelId,
  temperature = 0.2,
  maxTokens = 4096,
  useCache = true,
  customApiKey,
  customBaseUrl,
  onCacheStatus
}: CallLLMOptions): Promise<string> {
  const timer = log.startTimer('LLM call');
  
  // Get provider config
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  
  // Default to first model if not specified
  const actualModelId = modelId || provider.models[0]?.id || DEFAULT_MODEL;
  
  // Log the call
  await logToFile(`PROVIDER: ${providerId}, MODEL: ${actualModelId}, PROMPT: ${prompt.substring(0, 100)}...`);
  log.info('LLM call started', { provider: providerId, model: actualModelId });
  
  // Check cache if enabled
  if (useCache) {
    const cache = await loadCache();
    const cached = findMatchingEntry(cache, prompt, { 
      provider: providerId, 
      model: actualModelId 
    });
    
    if (cached) {
      cache.stats.totalHits++;
      await saveCache();
      
      if (onCacheStatus) onCacheStatus(true);
      timer();
      return cached.response;
    }
    
    cache.stats.totalMisses++;
  }
  
  try {
    let result: { content: string; usage?: { inputTokens: number; outputTokens: number } };
    
    // Get API key (may throw if not available and required)
    const apiKey = provider.requiresApiKey 
      ? getApiKey(providerId, customApiKey) 
      : customApiKey || PROVIDER_IDS.OLLAMA;
    
    // Get base URL
    const baseUrl = customBaseUrl || getProviderBaseUrl(providerId);
    
    // Route to appropriate SDK
    switch (providerId) {
      case PROVIDER_IDS.ANTHROPIC:
        result = await callAnthropic(apiKey, actualModelId, prompt, temperature, maxTokens);
        break;
        
      case PROVIDER_IDS.GOOGLE:
        result = await callGoogle(apiKey, actualModelId, prompt, temperature, maxTokens);
        break;
        
      case PROVIDER_IDS.OPENROUTER:
        // OpenRouter requires extra headers
        result = await callOpenAICompatible(
          apiKey, 
          actualModelId, 
          prompt, 
          temperature, 
          maxTokens, 
          baseUrl,
          {
            'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
            'X-Title': 'GitHub Tutorial Generator'
          },
          providerId
        );
        break;
        
      case PROVIDER_IDS.AZURE:
        // Azure OpenAI has a different base URL format
        const azureBaseUrl = customBaseUrl || process.env.AZURE_OPENAI_ENDPOINT;
        if (!azureBaseUrl) {
          throw new Error(
            '☁️ Azure OpenAI is not configured. ' +
            'Please set AZURE_OPENAI_ENDPOINT in your .env.local file, ' +
            'or select a different provider.'
          );
        }
        result = await callOpenAICompatible(
          apiKey, 
          actualModelId, 
          prompt, 
          temperature, 
          maxTokens, 
          `${azureBaseUrl}/openai/deployments/${actualModelId}`,
          { 'api-key': apiKey },
          providerId
        );
        break;
        
      default:
        // OpenAI, Groq, DeepSeek, xAI, Ollama - all use OpenAI SDK
        result = await callOpenAICompatible(
          apiKey, 
          actualModelId, 
          prompt, 
          temperature, 
          maxTokens, 
          baseUrl,
          undefined,
          providerId
        );
    }
    
    if (!result.content) {
      throw new Error(`${providerId} API returned an empty response`);
    }
    
    log.info('LLM response received', { 
      provider: providerId, 
      model: actualModelId,
      chars: result.content.length,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens
    });
    
    // Calculate cost
    const cost = result.usage 
      ? calculateCost(providerId, actualModelId, result.usage.inputTokens, result.usage.outputTokens)
      : 0;
    
    if (cost > 0) {
      log.cost('API call', cost, { provider: providerId, model: actualModelId });
    }
    
    // Update cache if enabled
    if (useCache) {
      const cache = await loadCache();
      addCacheEntry(cache, prompt, result.content, {
        provider: providerId,
        model: actualModelId,
        tokenUsage: result.usage ? { 
          input: result.usage.inputTokens, 
          output: result.usage.outputTokens 
        } : undefined,
        cost
      });
      await saveCache();
    }
    
    if (onCacheStatus) onCacheStatus(false);
    timer();
    return result.content;
    
  } catch (error: unknown) {
    const err = error as Error & { code?: string; status?: number; type?: string };
    log.error('LLM call failed', { 
      provider: providerId, 
      model: actualModelId, 
      error: err.message 
    });
    
    // If the error already has a user-friendly format (starts with emoji), pass it through
    if (err.message?.match(/^[🔑🚫💳⏳❌🔍🔌⏱️🌐🔧☁️🦙]/)) {
      throw error;
    }
    
    // Get provider display name for user-friendly messages
    const providerName = provider?.name || providerId;
    
    // Parse error message for JSON error details
    let errorDetails = '';
    try {
      const match = err.message?.match(/\{.*\}/s);
      if (match) {
        const parsed = JSON.parse(match[0]);
        errorDetails = parsed.error?.message || parsed.message || '';
      }
    } catch {
      // Ignore JSON parse errors
    }
    
    // Provide helpful error messages based on status code and error type
    if (err.status === 401 || err.code === 'invalid_api_key' || err.message?.includes('authentication_error') || err.message?.includes('invalid x-api-key') || err.message?.includes('Incorrect API key')) {
      throw new Error(
        `🔑 Authentication failed for ${providerName}. ` +
        `Please check that your API key is valid and properly configured. ` +
        (errorDetails ? `(${errorDetails})` : '')
      );
    } else if (err.status === 403 || err.message?.includes('permission') || err.message?.includes('forbidden')) {
      throw new Error(
        `🚫 Access denied for ${providerName}. ` +
        `Your API key may not have permission to use this model. ` +
        (errorDetails ? `(${errorDetails})` : '')
      );
    } else if (err.code === 'insufficient_quota' || err.status === 402 || err.message?.includes('quota') || err.message?.includes('billing') || err.message?.includes('Insufficient Balance')) {
      throw new Error(
        `💳 ${providerName} account has insufficient balance or quota. ` +
        `Please add credits to your account or check your billing settings.`
      );
    } else if (err.status === 429 || err.message?.includes('rate_limit') || err.message?.includes('too many requests')) {
      throw new Error(
        `⏳ ${providerName} rate limit exceeded. ` +
        `Please wait a moment and try again.`
      );
    } else if (err.status === 400 || err.message?.includes('bad_request')) {
      throw new Error(
        `❌ Bad request to ${providerName}: ${errorDetails || err.message}. ` +
        `The model "${actualModelId}" may not support the requested parameters.`
      );
    } else if (err.status === 404 || err.message?.includes('not_found') || err.message?.includes('does not exist')) {
      throw new Error(
        `🔍 Model "${actualModelId}" not found on ${providerName}. ` +
        `Please select a different model.`
      );
    } else if (err.message?.includes('ECONNREFUSED')) {
      if (providerId === PROVIDER_IDS.OLLAMA) {
        throw new Error(
          `🦙 Cannot connect to Ollama. ` +
          `Make sure Ollama is running with: ollama serve`
        );
      }
      throw new Error(
        `🔌 Cannot connect to ${providerName}. ` +
        `Please check your internet connection.`
      );
    } else if (err.message?.includes('ETIMEDOUT') || err.message?.includes('timeout')) {
      throw new Error(
        `⏱️ Request to ${providerName} timed out. ` +
        `The service may be slow or unavailable.`
      );
    } else if (err.message?.includes('<!DOCTYPE') || err.message?.includes('<html')) {
      throw new Error(
        `🌐 Received HTML instead of JSON from ${providerName}. ` +
        `The API endpoint may be unreachable or misconfigured.`
      );
    } else if (err.status === 500 || err.status === 502 || err.status === 503) {
      throw new Error(
        `🔧 ${providerName} service error (${err.status}). ` +
        `The service may be temporarily unavailable. Please try again later.`
      );
    }
    
    // Generic error with original message
    throw new Error(
      `❌ ${providerName} error: ${errorDetails || err.message || 'Unknown error occurred'}`
    );
  }
}

/**
 * Extended call that returns full result with metadata
 */
export async function callLLMWithMetadata(options: CallLLMOptions): Promise<CallLLMResult> {
  let cached = false;
  
  const content = await callLLM({
    ...options,
    onCacheStatus: (hit) => {
      cached = hit;
      if (options.onCacheStatus) options.onCacheStatus(hit);
    }
  });
  
  return {
    content,
    cached
  };
}

/**
 * Test connection to a provider
 */
export async function testProviderConnection(config: ProviderConfig): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const start = Date.now();
  
  try {
    const result = await callLLM({
      prompt: 'Say "OK" and nothing else.',
      provider: config.providerId,
      model: config.modelId,
      customApiKey: config.apiKey,
      customBaseUrl: config.baseUrl,
      useCache: false,
      maxTokens: 10,
      temperature: 0
    });
    
    const latencyMs = Date.now() - start;
    
    if (result.toLowerCase().includes('ok')) {
      return {
        success: true,
        message: `Connected successfully to ${config.providerId}`,
        latencyMs
      };
    } else {
      return {
        success: true,
        message: `Connected but unexpected response: ${result.substring(0, 50)}`,
        latencyMs
      };
    }
  } catch (error: unknown) {
    const err = error as Error;
    return {
      success: false,
      message: err.message || 'Unknown error'
    };
  }
}

/**
 * Get current cache statistics
 */
export async function getCacheStats() {
  const cache = await loadCache();
  return {
    entries: Object.keys(cache.entries).length,
    hits: cache.stats.totalHits,
    misses: cache.stats.totalMisses,
    hitRate: cache.stats.totalHits + cache.stats.totalMisses > 0
      ? cache.stats.totalHits / (cache.stats.totalHits + cache.stats.totalMisses)
      : 0
  };
}

/**
 * Clear all cache entries
 */
export async function clearCache(): Promise<void> {
  cacheStore = createCacheStore();
  await saveCache();
  log.info('Cache cleared');
}

// Re-export for backwards compatibility
export { getApiKey as getOpenAIApiKey };
