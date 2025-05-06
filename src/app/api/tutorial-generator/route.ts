import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { runTutorialFlow } from '@/lib/tutorialFlow';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    console.log(`[TutorialAPI] Received payload: ${JSON.stringify(payload)}`);
    
    // Extract all required fields from the request
    const {
      files,
      repo_url,
      include_patterns = ['.js', '.ts', '.jsx', '.tsx', '.md'],
      exclude_patterns = ['node_modules', '.git', 'dist', 'build'],
      project_name,
      language = 'english',
      use_cache = true,
      max_abstraction_num = 5,
      max_file_size = 1000000, // Default to 1MB if not provided
      use_mock = false
    } = payload;

    console.log(`[TutorialAPI] Received request for ${repo_url}, mock mode: ${use_mock}`);

    // Validate repository URL
    if (!repo_url) {
      return NextResponse.json({ error: "Repository URL is required" }, { status: 400 });
    }
    
    // Validate files data - make sure it's an array and convert to proper format if needed
    let processedFiles = [];
    if (!files || !Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "Files data is required" }, { status: 400 });
    } else {
      // Ensure files are in proper format
      processedFiles = files.map(file => {
        // If file is already a tuple array, use it directly
        if (Array.isArray(file) && file.length === 2) {
          return file;
        }
        // If file is an object with path and content, convert to tuple
        if (file.path && file.content) {
          return [file.path, file.content];
        }
        // Otherwise, just return as is and hope for the best
        return file;
      });
    }
    
    console.log(`[TutorialAPI] Processing ${processedFiles.length} files`);

    // Create shared context for the tutorial flow
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
      // Skip the fetch repo step since we already have files
      skip_fetch_repo: true
    };
    const OUTPUT_DIRECTORY = process.env.OUTPUT_DIRECTORY || 'output';
    console.log(`[TutorialAPI] Running tutorial flow with ${processedFiles.length} files`);
    const output_dir = path.join(process.cwd(), OUTPUT_DIRECTORY , shared.project_name, Date.now().toString());
    // Run the tutorial flow
    const result = await runTutorialFlow(shared);
    
    console.log(`[TutorialAPI] Tutorial flow completed, output dir: ${output_dir}`);
    
    // Return the result with any output directory information
    return NextResponse.json({
      success: true,
      output_directory: output_dir,
      message: "Tutorial created successfully"
    });
    
  } catch (error) {
    console.error('[TutorialAPI] Error generating tutorial:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate tutorial', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}