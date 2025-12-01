/**
 * LLM Preferences
 * Manages user preferences in localStorage (client-side only)
 */

import {
  PROVIDER_IDS,
  OPENAI_MODELS,
} from '@/lib/constants/llm';

const STORAGE_KEY = 'llm_preferences';

export interface LLMPreferences {
  providerId: string;
  modelId: string;
  baseUrl?: string;
  // Note: API keys are NOT stored for security
  rememberChoice: boolean;
  lastUsed: string;
}

const DEFAULT_PREFERENCES: LLMPreferences = {
  providerId: PROVIDER_IDS.OPENAI,
  modelId: OPENAI_MODELS.GPT_4O_MINI,
  rememberChoice: false,
  lastUsed: new Date().toISOString()
};

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

/**
 * Load preferences from localStorage
 */
export function loadPreferences(): LLMPreferences {
  if (!isBrowser()) {
    return DEFAULT_PREFERENCES;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
      };
    }
  } catch (error) {
    console.warn('Failed to load LLM preferences:', error);
  }
  
  return DEFAULT_PREFERENCES;
}

/**
 * Save preferences to localStorage
 */
export function savePreferences(prefs: Partial<LLMPreferences>): void {
  if (!isBrowser()) {
    return;
  }
  
  try {
    const current = loadPreferences();
    const updated: LLMPreferences = {
      ...current,
      ...prefs,
      lastUsed: new Date().toISOString()
    };
    
    // Only save if user opted in
    if (updated.rememberChoice) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (error) {
    console.warn('Failed to save LLM preferences:', error);
  }
}

/**
 * Clear stored preferences
 */
export function clearPreferences(): void {
  if (!isBrowser()) {
    return;
  }
  
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear LLM preferences:', error);
  }
}

/**
 * Check if user has opted into remembering preferences
 */
export function hasRememberedPreferences(): boolean {
  const prefs = loadPreferences();
  return prefs.rememberChoice;
}

/**
 * Update just the remember choice setting
 */
export function setRememberChoice(remember: boolean): void {
  if (!isBrowser()) {
    return;
  }
  
  if (remember) {
    const current = loadPreferences();
    savePreferences({ ...current, rememberChoice: true });
  } else {
    clearPreferences();
  }
}
