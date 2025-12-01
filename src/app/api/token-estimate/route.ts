/**
 * Token Estimation API
 * Provides token estimates for content before LLM calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  estimateTokensForFiles, 
  estimateTokensWithWarning,
  suggestLargerModels,
  parseTokenLimitError,
  calculateContentReduction,
} from '@/lib/tokenEstimator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      files, 
      prompt, 
      providerId, 
      modelId, 
      customContextWindow 
    } = body;
    
    if (!providerId || !modelId) {
      return NextResponse.json({
        error: 'Provider and model are required',
      }, { status: 400 });
    }
    
    let estimation;
    
    if (files && Array.isArray(files)) {
      // Estimate for files
      estimation = estimateTokensForFiles(
        files.map((f: { path?: string; content?: string } | [string, string]) => {
          if (Array.isArray(f)) {
            return { path: f[0], content: f[1] };
          }
          return { path: f.path || 'unknown', content: f.content || '' };
        }),
        providerId,
        modelId,
        { customContextWindow }
      );
    } else if (prompt) {
      // Estimate for single prompt
      estimation = estimateTokensWithWarning(
        prompt,
        providerId,
        modelId,
        { customContextWindow }
      );
    } else {
      return NextResponse.json({
        error: 'Either files or prompt is required',
      }, { status: 400 });
    }
    
    // Add model suggestions if over limit
    let suggestions: ReturnType<typeof suggestLargerModels> = [];
    if (estimation.isOverLimit) {
      suggestions = suggestLargerModels(providerId, modelId, estimation.estimatedTokens);
    }
    
    return NextResponse.json({
      ...estimation,
      suggestions,
    });
    
  } catch (error) {
    console.error('[TokenEstimate] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Parse a token limit error and get reduction recommendations
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { error, providerId, modelId } = body;
    
    if (!error) {
      return NextResponse.json({
        error: 'Error message is required',
      }, { status: 400 });
    }
    
    const parsed = parseTokenLimitError(error);
    
    if (!parsed.isTokenLimitError) {
      return NextResponse.json({
        isTokenLimitError: false,
        message: 'Not a token limit error',
      });
    }
    
    const response: {
      isTokenLimitError: boolean;
      requestedTokens?: number;
      limitTokens?: number;
      message: string;
      reduction?: ReturnType<typeof calculateContentReduction>;
      suggestions?: ReturnType<typeof suggestLargerModels>;
    } = {
      ...parsed,
    };
    
    // Calculate reduction needed
    if (parsed.requestedTokens && parsed.limitTokens) {
      response.reduction = calculateContentReduction(
        parsed.requestedTokens,
        parsed.limitTokens
      );
    }
    
    // Get model suggestions
    if (parsed.requestedTokens && providerId && modelId) {
      response.suggestions = suggestLargerModels(providerId, modelId, parsed.requestedTokens);
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('[TokenEstimate] Error parsing:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
