/**
 * LLM Test API
 * Tests connection to an LLM provider
 */

import { NextRequest, NextResponse } from 'next/server';
import { testProviderConnection } from '@/lib/llmMultiProvider';

// Rate limiting: Track last test time per IP
const lastTestTimes = new Map<string, number>();
const RATE_LIMIT_MS = 5000; // 5 seconds between tests

export async function POST(request: NextRequest) {
  // Simple rate limiting
  const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
  const lastTest = lastTestTimes.get(clientIp) || 0;
  const now = Date.now();
  
  if (now - lastTest < RATE_LIMIT_MS) {
    const waitTime = Math.ceil((RATE_LIMIT_MS - (now - lastTest)) / 1000);
    return NextResponse.json({
      success: false,
      message: `Please wait ${waitTime}s before testing again`,
    }, { status: 429 });
  }
  
  lastTestTimes.set(clientIp, now);
  
  // Clean up old entries periodically
  if (lastTestTimes.size > 1000) {
    const cutoff = now - RATE_LIMIT_MS * 2;
    for (const [ip, time] of lastTestTimes.entries()) {
      if (time < cutoff) {
        lastTestTimes.delete(ip);
      }
    }
  }
  
  try {
    const body = await request.json();
    const { provider, model, apiKey, baseUrl } = body;
    
    if (!provider || !model) {
      return NextResponse.json({
        success: false,
        message: 'Provider and model are required',
      }, { status: 400 });
    }
    
    const result = await testProviderConnection({
      providerId: provider,
      modelId: model,
      apiKey,
      baseUrl,
    });
    
    return NextResponse.json(result);
    
  } catch (error: unknown) {
    const err = error as Error;
    return NextResponse.json({
      success: false,
      message: err.message || 'Unknown error',
    }, { status: 500 });
  }
}
