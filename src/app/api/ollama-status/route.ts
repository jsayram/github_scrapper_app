/**
 * Ollama Status API
 * Checks if Ollama is running and returns available models
 */

import { NextResponse } from 'next/server';
import { ollamaModelToLLMModel, type LLMModel } from '@/lib/providers';

export async function GET() {
  const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  
  try {
    // Check if Ollama is running by fetching models
    const response = await fetch(`${ollamaUrl}/api/tags`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Short timeout to fail fast if Ollama isn't running
      signal: AbortSignal.timeout(3000),
    });
    
    if (!response.ok) {
      return NextResponse.json({
        available: false,
        error: `Ollama returned status ${response.status}`,
        models: [],
      });
    }
    
    const data = await response.json();
    
    // Convert Ollama model format to our format
    const models: LLMModel[] = (data.models || []).map((model: {
      name: string;
      modified_at?: string;
      size?: number;
      details?: {
        parameter_size?: string;
        family?: string;
      };
    }) => ollamaModelToLLMModel(model));
    
    // Mark some well-known models as recommended
    const recommendedModels = ['llama3.2', 'llama3.1', 'deepseek-coder', 'codellama', 'mistral'];
    models.forEach(model => {
      if (recommendedModels.some(rec => model.id.includes(rec))) {
        model.recommended = true;
      }
    });
    
    return NextResponse.json({
      available: true,
      models,
      modelCount: models.length,
    });
    
  } catch (error: unknown) {
    const err = error as Error;
    
    // Check if it's a connection error (Ollama not running)
    if (err.name === 'AbortError' || err.message?.includes('ECONNREFUSED') || err.message?.includes('fetch failed')) {
      return NextResponse.json({
        available: false,
        error: 'Ollama is not running. Start it with: ollama serve',
        models: [],
      });
    }
    
    return NextResponse.json({
      available: false,
      error: err.message || 'Unknown error checking Ollama status',
      models: [],
    });
  }
}
