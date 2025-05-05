'use client';

import { useState } from 'react';

interface LlmServiceProps {
  defaultModel?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

interface CallOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useCache?: boolean;
}

export function LlmService({
  defaultModel = 'gpt-3.5-turbo',
  defaultTemperature = 0.2,
  defaultMaxTokens = 4096,
}: LlmServiceProps) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const callOpenAI = async (
    prompt: string,
    options?: Partial<Omit<CallOptions, 'prompt'>>
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      // Call our API endpoint instead of using direct OpenAI integration
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: options?.model || defaultModel,
          temperature: options?.temperature || defaultTemperature,
          maxTokens: options?.maxTokens || defaultMaxTokens,
          useCache: options?.useCache !== undefined ? options.useCache : true,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to call LLM API');
      }
      
      setResponse(data.result);
      return data.result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    callOpenAI,
    loading,
    response,
    error,
  };
}

/**
 * Custom hook that provides LLM functionality to React components
 */
export function useLLM(options?: LlmServiceProps) {
  return LlmService(options || {});
}