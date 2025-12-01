import { NextResponse } from "next/server";
import { callLLMWithMetadata } from "@/lib/llmMultiProvider";
import { PROVIDER_IDS } from "@/lib/constants/llm";

export async function POST(request: Request) {
  try {
    // Extract parameters from request
    const { prompt, provider, model, temperature, maxTokens, useCache, customApiKey } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    
    // Use the multi-provider LLM service with metadata
    const result = await callLLMWithMetadata({ 
      prompt, 
      provider: provider || PROVIDER_IDS.OPENAI, // Default to OpenAI
      model, 
      temperature, 
      maxTokens, 
      useCache,
      customApiKey
    });
    
    // Return the result with metadata
    return NextResponse.json({ 
      result: result.content,
      cached: result.cached,
      usage: result.usage,
      cost: result.cost
    });
    
  } catch (error) {
    console.error("LLM API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process LLM request: ${message}` }, 
      { status: 500 }
    );
  }
}