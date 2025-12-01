'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import LLMProviderSelector from '@/components/LLMProviderSelector';

interface LLMConfig {
  providerId: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
}

export default function LlmTestPage() {
  const [prompt, setPrompt] = useState('');
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [usage, setUsage] = useState<{inputTokens: number, outputTokens: number} | null>(null);
  const [responseTime, setResponseTime] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  
  // LLM configuration from the shared component
  const [llmConfig, setLLMConfig] = useState<LLMConfig>({
    providerId: 'openai',
    modelId: 'gpt-4o-mini',
  });

  // Handle provider/model changes from the shared component
  const handleProviderChange = useCallback((
    providerId: string, 
    modelId: string, 
    apiKey?: string, 
    baseUrl?: string
  ) => {
    setLLMConfig({ providerId, modelId, apiKey, baseUrl });
  }, []);

  // Handle the form submission using the API endpoint with selected provider
  const handleApiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    if (!llmConfig.providerId || !llmConfig.modelId) {
      setApiError('Please select or enter a provider and model');
      return;
    }
    
    setApiLoading(true);
    setApiResponse(null);
    setApiError(null);
    setUsage(null);
    setResponseTime(null);
    setCached(false);
    
    const startTime = Date.now();
    
    try {
      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          provider: llmConfig.providerId,
          model: llmConfig.modelId,
          customApiKey: llmConfig.apiKey || undefined,
          customBaseUrl: llmConfig.baseUrl || undefined
        }),
      });
      
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setApiResponse(data.result);
      setResponseTime(Date.now() - startTime);
      setCached(data.cached || false);
      
      if (data.usage) {
        setUsage(data.usage);
      }
    } catch (err) {
      console.error('Error with LLM API:', err);
      setApiError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setApiLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      {/* Navigation */}
      <div className="mb-4">
        <Link 
          href="/"
          className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          ← Back to Scraper
        </Link>
      </div>
      
      <h1 className="text-3xl font-bold mb-6 text-center">Multi-Provider LLM Test</h1>
      
      {/* Provider and Model Selection - Using shared component */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
        <h2 className="text-lg font-semibold mb-3">🤖 LLM Configuration</h2>
        <LLMProviderSelector
          onProviderChange={handleProviderChange}
        />
      </div>
      
      {/* Prompt Input */}
      <div className="mb-6">
        <label htmlFor="prompt" className="block mb-2 text-lg font-medium">Enter a prompt:</label>
        <textarea
          id="prompt"
          className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg min-h-[150px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white dark:bg-gray-900"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
        />
      </div>
      
      {/* Submit and Results */}
      <div className="mb-10">
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-3">Test Multi-Provider LLM</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            Using: <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{llmConfig.providerId || '(select provider)'}</span> / <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{llmConfig.modelId || '(select model)'}</span>
          </p>
          <button
            onClick={handleApiSubmit}
            disabled={apiLoading || !prompt || !llmConfig.providerId || !llmConfig.modelId}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-md disabled:opacity-50 mb-4 hover:from-purple-600 hover:to-blue-600 transition-colors w-full font-medium"
          >
            {apiLoading ? 'Processing...' : '🚀 Submit Prompt'}
          </button>
          
          {/* Token Usage and Response Time */}
          {(usage || responseTime || cached) && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 text-sm">
              {cached && (
                <p className="text-green-700 dark:text-green-300">✅ Response from cache</p>
              )}
              {responseTime && (
                <p className="text-blue-700 dark:text-blue-300">⏱️ Response time: {responseTime}ms</p>
              )}
              {usage && (
                <p className="text-blue-700 dark:text-blue-300">📊 Tokens: {usage.inputTokens} in / {usage.outputTokens} out</p>
              )}
            </div>
          )}
          
          {/* Error Display */}
          {apiError && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <h3 className="font-medium text-red-800 dark:text-red-300 mb-1">Error</h3>
                  <p className="text-red-700 dark:text-red-400 text-sm whitespace-pre-wrap">{apiError}</p>
                  <button
                    onClick={() => setApiError(null)}
                    className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {apiResponse && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="font-medium mb-2 text-green-700 dark:text-green-400">Response:</h3>
              <div className="whitespace-pre-wrap bg-white dark:bg-gray-900 p-3 rounded border dark:border-gray-700 text-gray-800 dark:text-gray-200 font-medium shadow-inner max-h-96 overflow-y-auto">
                {apiResponse}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Info Section */}
      <div className="p-5 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg shadow-sm">
        <h3 className="text-lg font-medium mb-3 text-yellow-800 dark:text-yellow-300">Supported Providers:</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">🤖 OpenAI</div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">🔮 Anthropic</div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">💫 Google</div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">⚡ Groq (Free)</div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">🦙 Ollama (Local)</div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">🌐 OpenRouter</div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">✖️ xAI</div>
          <div className="p-2 bg-white dark:bg-gray-800 rounded border">☁️ Azure</div>
        </div>
        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-1">💡 Custom Provider Support</h4>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Toggle &quot;Custom&quot; to use any OpenAI-compatible API (Mistral, Together AI, Perplexity, local LLMs, etc.). 
            Enter the provider name, model ID, and optionally a custom base URL.
          </p>
        </div>
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          The Multi-Provider API uses the <code className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">callLLM</code> function which routes to the appropriate SDK based on provider.
        </p>
      </div>
    </div>
  );
}