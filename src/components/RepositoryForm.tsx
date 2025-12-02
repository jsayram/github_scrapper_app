'use client';

import React, { useState, useCallback } from 'react';
import LLMProviderSelector from './LLMProviderSelector';
import CostEstimator from './CostEstimator';
import CacheStatusPreview from './CacheStatusPreview';
import GenerationSettings, { GenerationSettingsConfig, GENERATION_DEFAULTS } from './GenerationSettings';
import { PROVIDER_IDS, OPENAI_MODELS } from '@/lib/constants/llm';

export interface LLMConfig {
  providerId: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
  regenerationMode?: 'full' | 'partial' | 'skip';
  documentationMode?: 'tutorial' | 'architecture';
  // Generation settings (now user-configurable)
  generationSettings?: GenerationSettingsConfig;
}

// Re-export for convenience
export { GENERATION_DEFAULTS };
export type { GenerationSettingsConfig };

interface RepositoryFormProps {
  repoUrl: string;
  onRepoUrlChange: (value: string) => void;
  githubToken: string;
  onGithubTokenChange: (value: string) => void;
  // Legacy prop for backward compatibility
  openaiApiKey?: string;
  onOpenaiApiKeyChange?: (value: string) => void;
  // New LLM config props
  llmConfig?: LLMConfig;
  onLLMConfigChange?: (config: LLMConfig) => void;
  // For cost estimation
  fileCount?: number;
  totalChars?: number;
}

const RepositoryForm: React.FC<RepositoryFormProps> = ({
  repoUrl,
  onRepoUrlChange,
  githubToken,
  onGithubTokenChange,
  openaiApiKey,
  onOpenaiApiKeyChange,
  llmConfig,
  onLLMConfigChange,
  fileCount = 0,
  totalChars = 0,
}) => {
  const [showGithubTokenHelp, setShowGithubTokenHelp] = useState(false);
  
  // Internal LLM state if not controlled externally
  const [internalLLMConfig, setInternalLLMConfig] = useState<LLMConfig>({
    providerId: PROVIDER_IDS.OPENAI,
    modelId: OPENAI_MODELS.GPT_4O_MINI,
    documentationMode: 'architecture',
  });
  
  // Use external config if provided, otherwise use internal
  const currentConfig = llmConfig || internalLLMConfig;
  
  const handleProviderChange = useCallback((
    providerId: string, 
    modelId: string, 
    apiKey?: string, 
    baseUrl?: string
  ) => {
    const newConfig: LLMConfig = { 
      providerId, 
      modelId, 
      apiKey, 
      baseUrl,
      regenerationMode: currentConfig.regenerationMode 
    };
    
    if (onLLMConfigChange) {
      onLLMConfigChange(newConfig);
    } else {
      setInternalLLMConfig(newConfig);
    }
    
    // Also update legacy prop if provided (for backward compatibility)
    if (onOpenaiApiKeyChange && apiKey !== undefined) {
      onOpenaiApiKeyChange(apiKey);
    }
  }, [onLLMConfigChange, onOpenaiApiKeyChange, currentConfig.regenerationMode]);

  const handleRegenerationModeSelect = useCallback((mode: 'full' | 'partial' | 'skip') => {
    const newConfig: LLMConfig = { ...currentConfig, regenerationMode: mode };
    
    if (onLLMConfigChange) {
      onLLMConfigChange(newConfig);
    } else {
      setInternalLLMConfig(newConfig);
    }
  }, [currentConfig, onLLMConfigChange]);

  const handleConfigChange = useCallback((updates: Partial<LLMConfig>) => {
    const newConfig: LLMConfig = { ...currentConfig, ...updates };
    
    if (onLLMConfigChange) {
      onLLMConfigChange(newConfig);
    } else {
      setInternalLLMConfig(newConfig);
    }
  }, [currentConfig, onLLMConfigChange]);

  const handleGenerationSettingsChange = useCallback((settings: GenerationSettingsConfig) => {
    const newConfig: LLMConfig = { ...currentConfig, generationSettings: settings };
    
    if (onLLMConfigChange) {
      onLLMConfigChange(newConfig);
    } else {
      setInternalLLMConfig(newConfig);
    }
  }, [currentConfig, onLLMConfigChange]);

  // Get current generation settings (with defaults)
  const currentGenerationSettings: GenerationSettingsConfig = currentConfig.generationSettings || { ...GENERATION_DEFAULTS };

  return (
    <div className="space-y-4 mb-4">
      {/* Repository URL and GitHub Token Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="repoUrl"
            className="block text-sm font-medium mb-1"
          >
            GitHub Repository URL
          </label>
          <input
            id="repoUrl"
            type="text"
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            value={repoUrl}
            onChange={(e) => onRepoUrlChange(e.target.value)}
            placeholder="https://github.com/username/repository"
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="githubToken"
              className="block text-sm font-medium"
            >
              GitHub Token (optional)
            </label>
            <button
              type="button"
              onClick={() => setShowGithubTokenHelp(!showGithubTokenHelp)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showGithubTokenHelp ? 'Hide' : 'Help'}
            </button>
          </div>
          <input
            id="githubToken"
            type="password"
            className="w-full p-2 border rounded-md dark:bg-gray-800 dark:border-gray-700"
            value={githubToken}
            onChange={(e) => onGithubTokenChange(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxx"
          />
          {showGithubTokenHelp ? (
            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded text-xs text-gray-600 dark:text-gray-300">
              <p className="mb-1"><strong>Required for:</strong> Private repositories, higher rate limits</p>
              <p>Create one at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">GitHub Settings → Tokens</a></p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Required for private repositories
            </p>
          )}
        </div>
      </div>

      {/* LLM Provider Selection */}
      <div className="border rounded-md p-4 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
          🤖 LLM Configuration
          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
            Choose your AI provider and model
          </span>
        </h3>
        
        {/* Documentation Mode Dropdown */}
        <div className="mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <label htmlFor="documentationMode" className="text-sm font-medium mb-2 block">📄 Documentation Type</label>
          <select
            id="documentationMode"
            value={currentConfig.documentationMode || 'architecture'}
            onChange={(e) => handleConfigChange({ documentationMode: e.target.value as 'tutorial' | 'architecture' })}
            className="w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 text-sm"
          >
            <option value="architecture">🏗️ Architecture - High-level overview with Mermaid diagrams</option>
            <option value="tutorial">📚 Tutorial - Step-by-step learning guide</option>
          </select>
          {(currentConfig.documentationMode || 'architecture') === 'architecture' && (
            <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">
              ✨ Architecture mode uses signature extraction for ~80% fewer tokens
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Selector */}
          <LLMProviderSelector
            onProviderChange={handleProviderChange}
          />
          
          {/* Cost Estimator - only show if we have file data */}
          {totalChars > 0 && (
            <CostEstimator
              providerId={currentConfig.providerId}
              modelId={currentConfig.modelId}
              fileCount={fileCount}
              totalChars={totalChars}
            />
          )}
        </div>
        
        {/* Quick tips */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 px-2 py-1 rounded">
              💡 Groq is free and fast
            </span>
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 px-2 py-1 rounded">
              🏠 Ollama runs locally (free)
            </span>
            <span className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded">
              ⚡ GPT-4o-mini is cost-effective
            </span>
          </div>
        </div>
      </div>

      {/* Generation Settings - Advanced Configuration */}
      <GenerationSettings
        settings={currentGenerationSettings}
        onSettingsChange={handleGenerationSettingsChange}
      />

      {/* Cache Status Preview - show when repo URL is provided */}
      {repoUrl && (
        <CacheStatusPreview
          repoUrl={repoUrl}
          onModeSelect={handleRegenerationModeSelect}
        />
      )}
    </div>
  );
};

export default RepositoryForm;