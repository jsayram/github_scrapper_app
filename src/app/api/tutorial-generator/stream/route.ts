import { NextRequest } from 'next/server';
import { runTutorialFlowWithProgress, type ProgressCallback } from '@/lib/tutorialFlow';
import { PROVIDER_IDS, getModelContextWindow } from '@/lib/constants/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Parse request body first (before creating stream)
  let payload: any;
  try {
    payload = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  const encoder = new TextEncoder();
  
  // Create a TransformStream for SSE
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  
  // Helper to send SSE events
  const sendEvent = async (event: string, data: any) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  // Process the request in the background
  (async () => {
    try {
      const {
        files,
        repo_url,
        include_patterns = ['.js', '.ts', '.jsx', '.tsx', '.md'],
        exclude_patterns = ['node_modules', '.git', 'dist', 'build'],
        project_name,
        language = 'english',
        use_cache = true,
        max_abstraction_num = 5,
        max_file_size = 1000000,
        openai_api_key,
        llm_provider = PROVIDER_IDS.OPENAI,
        llm_model,
        llm_api_key,
        llm_base_url,
        regeneration_mode,
        force_full_regeneration = false,
        documentation_mode = 'tutorial', // 'tutorial' or 'architecture'
      } = payload;

      // Validate inputs
      if (!repo_url) {
        await sendEvent('error', { message: 'Repository URL is required' });
        await writer.close();
        return;
      }

      if (!files || !Array.isArray(files) || files.length === 0) {
        await sendEvent('error', { message: 'Files data is required' });
        await writer.close();
        return;
      }

      // Process files
      const processedFiles = files.map((file: any) => {
        if (Array.isArray(file) && file.length === 2) return file;
        if (file.path && file.content) return [file.path, file.content];
        return file;
      });

      // Send initial progress
      await sendEvent('progress', { 
        stage: 'starting',
        message: 'Starting tutorial generation...',
        progress: 0
      });

      // Create shared context
      const shared = {
        files: processedFiles,
        repo_url,
        include_patterns,
        exclude_patterns,
        project_name: project_name || repo_url.split('/').pop()?.replace(/\.git$/, '') || 'GitHub-Tutorial',
        language,
        use_cache,
        max_abstraction_num,
        max_file_size,
        skip_fetch_repo: true,
        openai_api_key: llm_api_key || openai_api_key,
        llm_provider,
        llm_model,
        llm_api_key: llm_api_key || openai_api_key,
        llm_base_url,
        force_full_regeneration,
        requested_regeneration_mode: regeneration_mode,
        documentation_mode, // 'tutorial' or 'architecture'
        // Dynamic context window based on model
        model_context_window: llm_model ? getModelContextWindow(llm_model) : 128000,
      };

      // Progress callback for streaming updates
      const onProgress: ProgressCallback = async (update) => {
        await sendEvent('progress', update);
      };

      // Run the tutorial flow with progress tracking
      const result = await runTutorialFlowWithProgress(shared, onProgress);

      // Send completion event
      await sendEvent('complete', { 
        success: true,
        message: 'Tutorial created successfully',
        result 
      });

    } catch (error) {
      console.error('[TutorialStream] Error:', error);
      await sendEvent('error', { 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      await writer.close();
    }
  })();

  // Return the SSE response
  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
