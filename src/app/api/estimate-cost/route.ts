/**
 * Cost Estimation API
 * Estimates LLM costs for tutorial generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  estimateTokens, 
  calculateCost, 
  formatCost,
  type CostEstimate 
} from '@/lib/costEstimator';
import { getProvider, getModel } from '@/lib/providers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      providerId, 
      modelId, 
      totalChars, 
      fileCount, 
      estimatedChapters = 8,
      // Optional: pass actual file contents for more accurate estimate
      fileContents 
    } = body;
    
    if (!providerId || !modelId) {
      return NextResponse.json({
        error: 'Provider and model are required',
      }, { status: 400 });
    }
    
    const provider = getProvider(providerId);
    const model = getModel(providerId, modelId);
    
    if (!provider || !model) {
      return NextResponse.json({
        error: `Unknown provider/model: ${providerId}/${modelId}`,
      }, { status: 400 });
    }
    
    // Estimate tokens
    let tokens;
    if (fileContents && Array.isArray(fileContents)) {
      // Use actual file contents if provided
      tokens = estimateTokens(fileContents, estimatedChapters);
    } else if (totalChars) {
      // Estimate from total character count
      const fakeFiles = [{ path: 'combined', content: 'x'.repeat(totalChars) }];
      tokens = estimateTokens(fakeFiles, estimatedChapters);
    } else {
      return NextResponse.json({
        error: 'Either totalChars or fileContents is required',
      }, { status: 400 });
    }
    
    // Calculate cost
    const cost = calculateCost(model, tokens);
    const isFree = model.costPer1kInput === 0 && model.costPer1kOutput === 0;
    
    const estimate: CostEstimate = {
      provider: provider.name,
      model: model.name,
      tokens,
      costLow: cost.low,
      costEstimated: cost.estimated,
      costHigh: cost.high,
      isFree,
      formattedCost: formatCost(cost),
    };
    
    return NextResponse.json(estimate);
    
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Cost estimation error:', err);
    return NextResponse.json({
      error: err.message || 'Unknown error',
    }, { status: 500 });
  }
}
