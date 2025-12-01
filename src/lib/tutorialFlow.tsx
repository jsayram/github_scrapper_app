import { Flow } from "pocketflow";
import path from 'path';

// Re-export or alias node classes from your local implementation
import {
  FetchRepo,
  IdentifyAbstractions,
  AnalyzeRelationships,
  OrderChapters,
  WriteChapters,
  CombineTutorial,
} from "@/lib/nodes";

/**
 * Creates a Pocket Flow that pulls a GitHub repo and turns it into a multi-chapter tutorial.
 *
 * Equivalent to the original Python example:
 *
 * ```python
 * fetch_repo >> identify_abstractions >> analyze_relationships >> order_chapters >> write_chapters >> combine_tutorial
 * ```
 */
export function createTutorialFlow(skipFetchRepo = false): Flow {
  // 1️⃣  Instantiate nodes
  const fetchRepo = new FetchRepo(5, 20);
  const identifyAbstractions = new IdentifyAbstractions(5, 20);
  const analyzeRelationships = new AnalyzeRelationships(5, 20);
  const orderChapters = new OrderChapters(5, 20);
  const writeChapters = new WriteChapters(5, 20); // BatchNode
  const combineTutorial = new CombineTutorial(3, 20);

  // 2️⃣  Wire up the DAG using the fluent `.next()` helper provided by Pocket Flow
  // If skipFetchRepo is true, start the flow from identifyAbstractions
  if (skipFetchRepo) {
    // When skipping FetchRepo, start the flow from identifyAbstractions
    identifyAbstractions
      .next(analyzeRelationships)
      .next(orderChapters)
      .next(writeChapters)
      .next(combineTutorial);
    
    // Return a flow instance starting at identifyAbstractions
    return new Flow(identifyAbstractions);
  } else {
    // Normal flow including fetchRepo
    fetchRepo
      .next(identifyAbstractions)
      .next(analyzeRelationships)
      .next(orderChapters)
      .next(writeChapters)
      .next(combineTutorial);
      
    // Return a flow instance starting at fetchRepo
    return new Flow(fetchRepo);
  }
}

/**
 * Executes the tutorial flow with the provided shared data
 * This function creates a flow instance and runs it, similar to:
 * 
 * ```python
 * # Create the flow instance
 * tutorial_flow = create_tutorial_flow()
 * # Run the flow
 * tutorial_flow.run(shared)
 * ```
 */
export async function runTutorialFlow(shared: any): Promise<any> {
  console.log(`[TutorialFlow] Creating tutorial flow instance`);
  
  // Check if we should skip the fetch repo step
  // skip_fetch_repo is true when files are already provided
  const skipFetchRepo = shared.skip_fetch_repo === true;
  
  if (skipFetchRepo) {
    console.log(`[TutorialFlow] Skipping FetchRepo step as files are already provided`);
  }
  
  // Create the flow instance with the appropriate configuration
  const flow = createTutorialFlow(skipFetchRepo);
  
  console.log(`[TutorialFlow] Running flow with ${shared.files?.length || 0} files`);
  console.log(`[TutorialFlow] Project: ${shared.project_name}`);
  
  try {
    // Run the flow with the shared data
    const result = await flow.run(shared);
    
    console.log(`[TutorialFlow] Flow execution completed successfully`);
    return result;
  } catch (error) {
    console.error(`[TutorialFlow] Flow execution failed:`, error);
    throw error;
  }
}