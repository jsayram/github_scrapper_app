'use client';

/**
 * LLM Provider Selector Component
 * Dropdown for selecting LLM provider and model with Ollama auto-detection
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LLM_PROVIDERS,
  DEFAULT_OLLAMA_MODELS,
  getProvider,
  type LLMProvider,
  type LLMModel,
} from '@/lib/providers';
import { loadPreferences, savePreferences, setRememberChoice } from '@/lib/llmPreferences';
import {
  PROVIDER_IDS,
  OPENAI_MODELS,
  getModelContextWindow,
} from '@/lib/constants/llm';

// Helper function to format context window size
function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(tokens % 1000000 === 0 ? 0 : 1)}M tokens`;
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(tokens % 1000 === 0 ? 0 : 1)}K tokens`;
  }
  return `${tokens} tokens`;
}

// Helper function to describe context window capacity
function getContextWindowDescription(tokens: number): string {
  // Rough estimates: 1 token ≈ 4 characters, 1 line ≈ 80 chars
  const chars = tokens * 4;
  const lines = Math.floor(chars / 80);
  const pages = Math.floor(lines / 50); // ~50 lines per page
  
  if (tokens >= 1000000) {
    return `≈ ${Math.floor(pages / 1000)}K+ pages of code`;
  } else if (tokens >= 100000) {
    return `≈ ${Math.floor(pages)} pages of code`;
  } else if (tokens >= 10000) {
    return `≈ ${Math.floor(pages)} pages`;
  }
  return `≈ ${lines.toLocaleString()} lines`;
}

interface LLMProviderSelectorProps {
  onProviderChange: (providerId: string, modelId: string, apiKey?: string, baseUrl?: string) => void;
  onTestConnection?: () => void;
  disabled?: boolean;
  className?: string;
}

interface OllamaStatus {
  available: boolean;
  models: LLMModel[];
  loading: boolean;
  error?: string;
}

export function LLMProviderSelector({
  onProviderChange,
  onTestConnection,
  disabled = false,
  className = '',
}: LLMProviderSelectorProps) {
  // State
  const [selectedProvider, setSelectedProvider] = useState<string>(PROVIDER_IDS.OPENAI);
  const [selectedModel, setSelectedModel] = useState<string>(OPENAI_MODELS.GPT_4O_MINI);
  const [apiKey, setApiKey] = useState<string>('');
  const [customBaseUrl, setCustomBaseUrl] = useState<string>('');
  const [rememberChoice, setRememberChoiceState] = useState<boolean>(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    available: false,
    models: [],
    loading: true,
  });
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  
  // Custom provider/model states
  const [useCustomProvider, setUseCustomProvider] = useState<boolean>(false);
  const [useCustomModel, setUseCustomModel] = useState<boolean>(false);
  const [customProviderName, setCustomProviderName] = useState<string>('');
  const [customModelName, setCustomModelName] = useState<string>('');
  
  // Get current provider and its models
  // Always get provider info from selectedProvider for model dropdown (even when using custom provider name)
  const currentProvider = getProvider(selectedProvider);
  const availableModels = selectedProvider === PROVIDER_IDS.OLLAMA && ollamaStatus.available
    ? ollamaStatus.models
    : currentProvider?.models || [];
  
  // Get the effective provider and model (custom or selected)
  const effectiveProvider = useCustomProvider ? customProviderName : selectedProvider;
  const effectiveModel = useCustomModel ? customModelName : selectedModel;

  // Load preferences on mount
  useEffect(() => {
    const prefs = loadPreferences();
    if (prefs.rememberChoice) {
      setSelectedProvider(prefs.providerId);
      setSelectedModel(prefs.modelId);
      setRememberChoiceState(true);
      if (prefs.baseUrl) {
        setCustomBaseUrl(prefs.baseUrl);
      }
    }
  }, []);

  // Check Ollama availability on mount
  useEffect(() => {
    checkOllamaStatus();
  }, []);

  // Notify parent of changes
  useEffect(() => {
    onProviderChange(
      effectiveProvider,
      effectiveModel,
      apiKey || undefined,
      customBaseUrl || undefined
    );
    
    // Save preferences if opted in (only for non-custom selections)
    if (rememberChoice && !useCustomProvider && !useCustomModel) {
      savePreferences({
        providerId: selectedProvider,
        modelId: selectedModel,
        baseUrl: customBaseUrl || undefined,
        rememberChoice: true,
      });
    }
  }, [effectiveProvider, effectiveModel, apiKey, customBaseUrl, onProviderChange, rememberChoice, useCustomProvider, useCustomModel, selectedProvider, selectedModel]);

  // Check Ollama status
  const checkOllamaStatus = useCallback(async () => {
    setOllamaStatus(prev => ({ ...prev, loading: true }));
    
    try {
      const response = await fetch('/api/ollama-status');
      const data = await response.json();
      
      if (data.available && data.models?.length > 0) {
        setOllamaStatus({
          available: true,
          models: data.models,
          loading: false,
        });
      } else {
        setOllamaStatus({
          available: false,
          models: DEFAULT_OLLAMA_MODELS,
          loading: false,
          error: data.error || 'Ollama not running',
        });
      }
    } catch (error) {
      setOllamaStatus({
        available: false,
        models: DEFAULT_OLLAMA_MODELS,
        loading: false,
        error: 'Failed to check Ollama status',
      });
    }
  }, []);

  // Handle provider change
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    setConnectionStatus(null);
    
    // Set default model for new provider
    const provider = getProvider(value);
    if (provider) {
      const models = value === PROVIDER_IDS.OLLAMA && ollamaStatus.available
        ? ollamaStatus.models
        : provider.models;
      
      // Prefer recommended model, otherwise first model
      const recommended = models.find(m => m.recommended);
      setSelectedModel(recommended?.id || models[0]?.id || '');
    }
  };

  // Handle model change
  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    setConnectionStatus(null);
  };

  // Test connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);
    
    try {
      const response = await fetch('/api/llm-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: effectiveProvider,
          model: effectiveModel,
          apiKey: apiKey || undefined,
          baseUrl: customBaseUrl || undefined,
        }),
      });
      
      const data = await response.json();
      
      setConnectionStatus({
        tested: true,
        success: data.success,
        message: data.message,
        latencyMs: data.latencyMs,
      });
    } catch (error) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: 'Failed to test connection',
      });
    } finally {
      setTestingConnection(false);
    }
    
    if (onTestConnection) {
      onTestConnection();
    }
  };

  // Handle remember choice toggle
  const handleRememberChoiceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setRememberChoiceState(checked);
    setRememberChoice(checked);
  };

  // Check if current provider needs API key
  const needsApiKey = useCustomProvider ? true : (currentProvider?.requiresApiKey ?? true);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Provider Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            LLM Provider
          </label>
          <label className="inline-flex items-center cursor-pointer">
            <span className="text-xs text-gray-500 mr-2">Custom</span>
            <input
              type="checkbox"
              checked={useCustomProvider}
              onChange={(e) => {
                setUseCustomProvider(e.target.checked);
                if (!e.target.checked) {
                  setCustomProviderName('');
                }
              }}
              disabled={disabled}
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
        {useCustomProvider ? (
          <input
            type="text"
            value={customProviderName}
            onChange={(e) => setCustomProviderName(e.target.value)}
            placeholder="e.g., openai, anthropic, mistral, together..."
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
        ) : (
          <Select
            value={selectedProvider}
            onValueChange={handleProviderChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="text-xs text-gray-500 dark:text-gray-400 font-semibold px-2 py-1.5">
                  Cloud Providers
                </SelectLabel>
                {LLM_PROVIDERS.filter(p => !p.isLocal).map(provider => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} {provider.recommended ? '⭐' : ''}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel className="text-xs text-gray-500 dark:text-gray-400 font-semibold px-2 py-1.5">
                  Local (Free)
                </SelectLabel>
                {LLM_PROVIDERS.filter(p => p.isLocal).map(provider => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name} {ollamaStatus.available ? '✓' : '⚠️'} 🆓
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {useCustomProvider 
            ? 'Enter any OpenAI-compatible provider name'
            : currentProvider?.description
          }
        </p>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Model
          </label>
          <label className="inline-flex items-center cursor-pointer">
            <span className="text-xs text-gray-500 mr-2">Custom</span>
            <input
              type="checkbox"
              checked={useCustomModel}
              onChange={(e) => {
                setUseCustomModel(e.target.checked);
                if (!e.target.checked) {
                  setCustomModelName('');
                }
              }}
              disabled={disabled}
              className="sr-only peer"
            />
            <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
        {useCustomModel ? (
          <input
            type="text"
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            placeholder="e.g., gpt-4o, claude-3-opus, mistral-large..."
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
        ) : (
          <Select
            value={selectedModel}
            onValueChange={handleModelChange}
            disabled={disabled || availableModels.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {model.name} {model.recommended ? '⭐' : ''} {model.costPer1kInput === 0 ? '🆓' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {useCustomModel ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Enter the exact model ID from your provider
          </p>
        ) : selectedModel && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {availableModels.find(m => m.id === selectedModel)?.description}
            </p>
            {/* Context Window Display */}
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                📊 {formatContextWindow(getModelContextWindow(selectedModel))} context
              </span>
              <span className="text-gray-400 dark:text-gray-500">
                {getContextWindowDescription(getModelContextWindow(selectedModel))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* API Key Input (if needed) */}
      {needsApiKey && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            API Key
            <span className="text-gray-400 font-normal ml-1">
              {useCustomProvider ? '(required for custom provider)' : '(optional if set in .env)'}
            </span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={useCustomProvider 
              ? `Enter API key for ${customProviderName || 'custom provider'}...`
              : `Enter ${currentProvider?.name || 'API'} key...`
            }
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {useCustomProvider 
              ? '🔑 API key is required for custom providers'
              : <>Or set <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  {currentProvider?.envVarNames?.[0] || 'API_KEY'}
                </code> in your .env.local file</>
            }
          </p>
        </div>
      )}

      {/* Custom Base URL (for Ollama, Azure, or custom providers) */}
      {(useCustomProvider || selectedProvider === PROVIDER_IDS.OLLAMA || selectedProvider === PROVIDER_IDS.AZURE) && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Base URL
            <span className="text-gray-400 font-normal ml-1">
              {useCustomProvider ? '(required for custom provider)' : '(optional)'}
            </span>
          </label>
          <input
            type="text"
            value={customBaseUrl}
            onChange={(e) => setCustomBaseUrl(e.target.value)}
            placeholder={useCustomProvider
              ? 'e.g., https://api.mistral.ai/v1 or https://api.together.xyz/v1'
              : selectedProvider === PROVIDER_IDS.OLLAMA 
                ? 'http://localhost:11434/v1' 
                : 'https://your-resource.openai.azure.com'
            }
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {useCustomProvider && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Enter the base URL for OpenAI-compatible APIs (Mistral, Together AI, Perplexity, etc.)
            </p>
          )}
        </div>
      )}

      {/* Remember Choice - hide when using custom */}
      {!useCustomProvider && !useCustomModel && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="rememberChoice"
            checked={rememberChoice}
            onChange={handleRememberChoiceChange}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label 
            htmlFor="rememberChoice" 
            className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
          >
            Remember my choice
          </label>
          <span className="text-xs text-gray-400">(API keys are never stored)</span>
        </div>
      )}
      
      {/* Current Selection Display */}
      {(useCustomProvider || useCustomModel) && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-800 text-sm">
          <p className="text-blue-700 dark:text-blue-300">
            Using: <span className="font-mono">{effectiveProvider || '(enter provider)'}</span> / <span className="font-mono">{effectiveModel || '(enter model)'}</span>
            <span className="ml-2 text-xs">(custom)</span>
          </p>
        </div>
      )}

      {/* Test Connection Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleTestConnection}
          disabled={disabled || testingConnection || !effectiveProvider || !effectiveModel}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 
                     dark:bg-gray-500 dark:hover:bg-gray-600 rounded-md
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors flex items-center gap-2"
        >
          {testingConnection ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Testing...
            </>
          ) : (
            'Test Connection'
          )}
        </button>
        
        {connectionStatus && (
          <div className={`text-sm flex items-center gap-1 ${
            connectionStatus.success 
              ? 'text-green-600 dark:text-green-400' 
              : 'text-red-600 dark:text-red-400'
          }`}>
            {connectionStatus.success ? (
              <>
                <span>✓</span>
                <span>{connectionStatus.message}</span>
                {connectionStatus.latencyMs && (
                  <span className="text-gray-400">({connectionStatus.latencyMs}ms)</span>
                )}
              </>
            ) : (
              <>
                <span>✗</span>
                <span>{connectionStatus.message}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Custom Provider Help */}
      {useCustomProvider && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>💡 Custom Provider Tips:</strong>
          </p>
          <ul className="mt-2 text-xs text-blue-700 dark:text-blue-300 list-disc list-inside space-y-1">
            <li>For OpenAI-compatible APIs, use provider name like &quot;openai&quot;</li>
            <li>Mistral: provider=&quot;mistral&quot;, base URL=&quot;https://api.mistral.ai/v1&quot;</li>
            <li>Together AI: provider=&quot;openai&quot;, base URL=&quot;https://api.together.xyz/v1&quot;</li>
            <li>Perplexity: provider=&quot;openai&quot;, base URL=&quot;https://api.perplexity.ai&quot;</li>
            <li>Local LLMs: Use your server&apos;s base URL with compatible models</li>
          </ul>
        </div>
      )}

      {/* Ollama Help */}
      {!useCustomProvider && selectedProvider === PROVIDER_IDS.OLLAMA && !ollamaStatus.available && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Ollama not detected.</strong> To use local models:
          </p>
          <ol className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 list-decimal list-inside space-y-1">
            <li>Install Ollama from <a href="https://ollama.ai" target="_blank" rel="noopener noreferrer" className="underline">ollama.ai</a></li>
            <li>Run <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">ollama serve</code> in terminal</li>
            <li>Pull a model: <code className="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">ollama pull llama3.2</code></li>
            <li>Click "Test Connection" above</li>
          </ol>
          <button
            onClick={checkOllamaStatus}
            disabled={ollamaStatus.loading}
            className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 underline hover:no-underline"
          >
            {ollamaStatus.loading ? 'Checking...' : 'Retry detection'}
          </button>
        </div>
      )}
    </div>
  );
}

export default LLMProviderSelector;
