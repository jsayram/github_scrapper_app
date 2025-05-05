import { Flow } from "pocketflow";

// Re‑export or alias node classes from your local implementation
import {
  FetchRepo,
  IdentifyAbstractions,
  AnalyzeRelationships,
  OrderChapters,
  WriteChapters,
  CombineTutorial,
} from "@/lib/nodes";

/**
 * Creates a Pocket Flow that pulls a GitHub repo and turns it into a multi‑chapter tutorial.
 *
 * Equivalent to the original Python example:
 *
 * ```python
 * fetch_repo >> identify_abstractions >> analyze_relationships >> order_chapters >> write_chapters >> combine_tutorial
 * ```
 */
export function createTutorialFlow(): Flow {
  // 1️⃣  Instantiate nodes
  const fetchRepo = new FetchRepo();
  const identifyAbstractions = new IdentifyAbstractions();
  const analyzeRelationships = new AnalyzeRelationships();
  const orderChapters = new OrderChapters();
  const writeChapters = new WriteChapters(); // BatchNode
  const combineTutorial = new CombineTutorial();

  // 2️⃣  Wire up the DAG using the fluent `.next()` helper provided by Pocket Flow
  fetchRepo
    .next(identifyAbstractions)
    .next(analyzeRelationships)
    .next(orderChapters)
    .next(writeChapters)
    .next(combineTutorial);

  // 3️⃣  Return a new Flow instance rooted at the first node
  return new Flow(fetchRepo);
}