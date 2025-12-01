import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// Cache statistics storage
interface CacheStats {
  totalCalls: number;
  hits: number;
  hitRate: string;
  misses: {
    total: number;
    reasons: {
      cacheDisabled: number;
      cacheEmpty: number;
      entryNotFound: number;
      modelMismatch: number;
      cacheError: number;
    };
  };
}

// Stats file path
const STATS_FILE = process.env.CACHE_STATS_FILE || "cache_stats.json";
const CACHE_FILE = process.env.LLM_CACHE_FILE || "llm_cache.json";

// Default stats
const defaultStats: CacheStats = {
  totalCalls: 0,
  hits: 0,
  hitRate: "0%",
  misses: {
    total: 0,
    reasons: {
      cacheDisabled: 0,
      cacheEmpty: 0,
      entryNotFound: 0,
      modelMismatch: 0,
      cacheError: 0,
    },
  },
};

// Load stats from file
async function loadStats(): Promise<CacheStats> {
  try {
    const statsPath = path.join(process.cwd(), STATS_FILE);
    const exists = await fs
      .access(statsPath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      const data = await fs.readFile(statsPath, "utf8");
      const parsed = JSON.parse(data);
      return { ...defaultStats, ...parsed };
    }
  } catch (error) {
    console.error("Error loading cache stats:", error);
  }
  return { ...defaultStats };
}

// Save stats to file
async function saveStats(stats: CacheStats): Promise<void> {
  try {
    const statsPath = path.join(process.cwd(), STATS_FILE);
    await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
  } catch (error) {
    console.error("Error saving cache stats:", error);
  }
}

// Get cache size info
async function getCacheInfo(): Promise<{
  entries: number;
  sizeBytes: number;
}> {
  try {
    const cachePath = path.join(process.cwd(), CACHE_FILE);
    const exists = await fs
      .access(cachePath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      const data = await fs.readFile(cachePath, "utf8");
      const cache = JSON.parse(data);
      const entries = Object.keys(cache).length;
      const sizeBytes = Buffer.byteLength(data, "utf8");
      return { entries, sizeBytes };
    }
  } catch (error) {
    console.error("Error getting cache info:", error);
  }
  return { entries: 0, sizeBytes: 0 };
}

// GET - Retrieve cache statistics
export async function GET() {
  try {
    const stats = await loadStats();
    const cacheInfo = await getCacheInfo();

    // Calculate hit rate
    if (stats.totalCalls > 0) {
      stats.hitRate = ((stats.hits / stats.totalCalls) * 100).toFixed(1) + "%";
      stats.misses.total = stats.totalCalls - stats.hits;
    }

    return NextResponse.json({
      stats,
      cache: {
        entries: cacheInfo.entries,
        sizeKB: (cacheInfo.sizeBytes / 1024).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error fetching cache stats:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch cache statistics: ${message}` },
      { status: 500 }
    );
  }
}

// POST - Update or reset cache statistics
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Reset stats
    if (body.reset) {
      await saveStats({ ...defaultStats });
      return NextResponse.json({
        message: "Cache statistics reset successfully",
        stats: defaultStats,
      });
    }

    // Increment stats
    if (body.increment) {
      const stats = await loadStats();
      const { type, reason } = body.increment;

      stats.totalCalls++;

      if (type === "hit") {
        stats.hits++;
      } else if (type === "miss") {
        stats.misses.total++;
        if (reason && stats.misses.reasons[reason as keyof typeof stats.misses.reasons] !== undefined) {
          stats.misses.reasons[reason as keyof typeof stats.misses.reasons]++;
        }
      }

      // Recalculate hit rate
      if (stats.totalCalls > 0) {
        stats.hitRate =
          ((stats.hits / stats.totalCalls) * 100).toFixed(1) + "%";
      }

      await saveStats(stats);
      return NextResponse.json({ message: "Stats updated", stats });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating cache stats:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to update cache statistics: ${message}` },
      { status: 500 }
    );
  }
}

// DELETE - Clear the cache file
export async function DELETE() {
  try {
    const cachePath = path.join(process.cwd(), CACHE_FILE);
    const exists = await fs
      .access(cachePath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      await fs.writeFile(cachePath, JSON.stringify({}, null, 2));
      return NextResponse.json({ message: "Cache cleared successfully" });
    }

    return NextResponse.json({ message: "Cache file does not exist" });
  } catch (error) {
    console.error("Error clearing cache:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to clear cache: ${message}` },
      { status: 500 }
    );
  }
}
