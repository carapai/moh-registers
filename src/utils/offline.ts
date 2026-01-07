/**
 * Offline-First Utilities
 *
 * Utilities for implementing stale-while-revalidate and local-first data fetching patterns
 */

/**
 * Network status check with immediate return
 */
export function isOnline(): boolean {
    return navigator.onLine;
}

/**
 * Stale-While-Revalidate Pattern
 *
 * Returns cached data immediately, then fetches fresh data in background.
 * This provides instant perceived performance while keeping data fresh.
 *
 * @param fetchLocal - Function to fetch data from local cache (fast)
 * @param fetchRemote - Function to fetch data from remote API (slow)
 * @param onUpdate - Optional callback when remote data arrives
 * @returns Promise with local data (may be stale)
 */
export async function staleWhileRevalidate<T>({
    fetchLocal,
    fetchRemote,
    onUpdate,
    skipRemote = false,
}: {
    fetchLocal: () => Promise<T | null>;
    fetchRemote: () => Promise<T>;
    onUpdate?: (data: T) => void;
    skipRemote?: boolean;
}): Promise<T> {
    console.log("🔄 staleWhileRevalidate: Fetching local data first");

    // Step 1: Try to get local data first (instant)
    const localData = await fetchLocal();

    // Step 2: If we have local data, return it immediately
    if (localData !== null) {
        console.log("💾 staleWhileRevalidate: Returning local data immediately");

        // Step 3: Fetch remote data in background (non-blocking)
        if (!skipRemote && isOnline()) {
            fetchRemote()
                .then((remoteData) => {
                    console.log("📡 staleWhileRevalidate: Remote data fetched, updating");
                    if (onUpdate) {
                        onUpdate(remoteData);
                    }
                })
                .catch((error) => {
                    console.log("📵 staleWhileRevalidate: Remote fetch failed, keeping local data", error);
                });
        }

        return localData;
    }

    // Step 4: No local data, must fetch remote (blocking)
    console.log("📡 staleWhileRevalidate: No local data, fetching from remote");
    return await fetchRemote();
}

/**
 * Merge local and remote data with deduplication
 *
 * @param local - Local data array
 * @param remote - Remote data array
 * @param idKey - Key to use for deduplication (default: 'id')
 * @returns Merged array with local-only items first, then remote items
 */
export function mergeWithPriority<T extends Record<string, any>>(
    local: T[],
    remote: T[],
    idKey: string = "id"
): T[] {
    // Create set of remote IDs for fast lookup
    const remoteIds = new Set(remote.map((item) => item[idKey]));

    // Get local items that don't exist in remote (newly created, not yet synced)
    const localOnly = local.filter((item) => !remoteIds.has(item[idKey]));

    console.log(`🔄 Merge: ${localOnly.length} local-only items, ${remote.length} remote items`);

    // Combine: local-only first (most important), then remote
    return [...localOnly, ...remote];
}

/**
 * Check if data is stale based on last update time
 *
 * @param lastUpdated - ISO timestamp of last update
 * @param maxAgeMs - Maximum age in milliseconds (default: 5 minutes)
 * @returns true if data is stale
 */
export function isStale(lastUpdated: string | undefined, maxAgeMs: number = 300000): boolean {
    if (!lastUpdated) return true;

    const age = Date.now() - new Date(lastUpdated).getTime();
    return age > maxAgeMs;
}
