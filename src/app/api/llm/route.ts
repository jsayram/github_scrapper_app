import { NextResponse } from "next/server";
import { callLLM, getApiKey } from "@/lib/llm";

export async function POST(request: Request) {
  try {
    // Make sure we have an API key before proceeding
    try {
      getApiKey();
    } catch (error) {
      return NextResponse.json(
        { error: "OpenAI API key not configured. Please add it to your .env file." }, 
        { status: 500 }
      );
    }
    
    // Extract parameters from request
    const { prompt, model, temperature, maxTokens, useCache } = await request.json();
    
    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    
    // Call the LLM service
    const result = await callLLM({ 
      prompt, 
      model, 
      temperature, 
      maxTokens, 
      useCache 
    });
    
    // Return the result
    return NextResponse.json({ result });
    
  } catch (error) {
    console.error("LLM API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process LLM request: ${message}` }, 
      { status: 500 }
    );
  }
}