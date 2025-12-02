'use client';

import React, { useState, useCallback } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, AlertCircle, Settings2 } from 'lucide-react';

// Default values for all generation parameters
export const GENERATION_DEFAULTS = {
  maxChapters: 5,
  maxLinesPerFile: 150,
  maxFileSize: 500000,
  temperature: 0.2,
  useCache: true,
  language: 'english',
} as const;

export interface GenerationSettingsConfig {
  maxChapters: number;
  maxLinesPerFile: number;
  maxFileSize: number;
  temperature: number;
  useCache: boolean;
  language: string;
}

interface GenerationSettingsProps {
  settings: GenerationSettingsConfig;
  onSettingsChange: (settings: GenerationSettingsConfig) => void;
  className?: string;
}

// Helper to check if a value differs from default
function isModified<K extends keyof GenerationSettingsConfig>(
  key: K,
  value: GenerationSettingsConfig[K]
): boolean {
  return value !== GENERATION_DEFAULTS[key];
}

// Helper to count modified settings
function countModified(settings: GenerationSettingsConfig): number {
  let count = 0;
  (Object.keys(GENERATION_DEFAULTS) as (keyof GenerationSettingsConfig)[]).forEach(key => {
    if (isModified(key, settings[key])) count++;
  });
  return count;
}

const GenerationSettings: React.FC<GenerationSettingsProps> = ({
  settings,
  onSettingsChange,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const modifiedCount = countModified(settings);

  const handleChange = useCallback(<K extends keyof GenerationSettingsConfig>(
    key: K,
    value: GenerationSettingsConfig[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  }, [settings, onSettingsChange]);

  const resetToDefaults = useCallback(() => {
    onSettingsChange({ ...GENERATION_DEFAULTS });
  }, [onSettingsChange]);

  const resetSingle = useCallback(<K extends keyof GenerationSettingsConfig>(key: K) => {
    onSettingsChange({ ...settings, [key]: GENERATION_DEFAULTS[key] });
  }, [settings, onSettingsChange]);

  // Input component with modified indicator
  const SettingInput: React.FC<{
    label: string;
    description: string;
    settingKey: keyof GenerationSettingsConfig;
    type: 'number' | 'text' | 'checkbox' | 'select';
    min?: number;
    max?: number;
    step?: number;
    options?: { value: string; label: string }[];
  }> = ({ label, description, settingKey, type, min, max, step, options }) => {
    const value = settings[settingKey];
    const modified = isModified(settingKey, value);

    return (
      <div className={`p-3 rounded-lg border transition-colors ${
        modified 
          ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600' 
          : 'border-border bg-muted/30'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium flex items-center gap-2">
            {label}
            {modified && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
                Modified
              </span>
            )}
          </label>
          {modified && (
            <button
              onClick={() => resetSingle(settingKey)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              title={`Reset to default (${GENERATION_DEFAULTS[settingKey]})`}
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-2">{description}</p>
        
        {type === 'checkbox' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value as boolean}
              onChange={(e) => handleChange(settingKey, e.target.checked as GenerationSettingsConfig[typeof settingKey])}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">{value ? 'Enabled' : 'Disabled'}</span>
            <span className="text-xs text-muted-foreground ml-auto">
              Default: {GENERATION_DEFAULTS[settingKey] ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        ) : type === 'select' ? (
          <div className="flex items-center gap-2">
            <select
              value={value as string}
              onChange={(e) => handleChange(settingKey, e.target.value as GenerationSettingsConfig[typeof settingKey])}
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
            >
              {options?.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Default: {GENERATION_DEFAULTS[settingKey]}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type={type}
              value={value as string | number}
              onChange={(e) => handleChange(
                settingKey, 
                type === 'number' ? Number(e.target.value) : e.target.value as GenerationSettingsConfig[typeof settingKey]
              )}
              min={min}
              max={max}
              step={step}
              className="flex-1 px-3 py-1.5 text-sm rounded-md border border-border bg-background focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              Default: {GENERATION_DEFAULTS[settingKey]}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Header - always visible */}
      <div className="w-full px-4 py-3 flex items-center justify-between bg-muted/50">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Generation Settings</span>
          {modifiedCount > 0 && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200">
              <AlertCircle className="h-3 w-3" />
              {modifiedCount} modified
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {modifiedCount > 0 && (
            <button
              onClick={resetToDefaults}
              className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Expandable content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-background">
          {/* Quick info */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              These settings control how the documentation is generated. Modified settings are highlighted in amber.
              Click &quot;Reset&quot; on individual settings or &quot;Reset All&quot; to restore defaults.
            </span>
          </div>

          {/* Settings grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SettingInput
              label="Max Chapters"
              description="Maximum number of chapters/abstractions to identify and document."
              settingKey="maxChapters"
              type="number"
              min={1}
              max={15}
            />
            
            <SettingInput
              label="Max Lines Per File"
              description="Maximum lines to include from each source file (truncates large files)."
              settingKey="maxLinesPerFile"
              type="number"
              min={50}
              max={500}
            />
            
            <SettingInput
              label="Max File Size"
              description="Maximum file size in bytes to process (larger files are skipped)."
              settingKey="maxFileSize"
              type="number"
              min={100000}
              max={2000000}
              step={100000}
            />
            
            <SettingInput
              label="Temperature"
              description="LLM creativity (0 = focused, 1 = creative). Lower is more consistent."
              settingKey="temperature"
              type="number"
              min={0}
              max={1}
              step={0.1}
            />
            
            <SettingInput
              label="Use Cache"
              description="Cache LLM responses to avoid redundant API calls and reduce costs."
              settingKey="useCache"
              type="checkbox"
            />
            
            <SettingInput
              label="Language"
              description="Language for generated documentation content."
              settingKey="language"
              type="select"
              options={[
                { value: 'english', label: 'English' },
                { value: 'spanish', label: 'Spanish' },
                { value: 'french', label: 'French' },
                { value: 'german', label: 'German' },
                { value: 'portuguese', label: 'Portuguese' },
                { value: 'chinese', label: 'Chinese' },
                { value: 'japanese', label: 'Japanese' },
                { value: 'korean', label: 'Korean' },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GenerationSettings;
