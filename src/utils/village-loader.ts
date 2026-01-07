import { db } from '../db';

/**
 * Village Loader Utility
 *
 * Loads village data from bundled JSON file into IndexedDB
 * for offline-first access. Uses lazy loading - only loads
 * when needed and caches in IndexedDB permanently.
 */

/**
 * Ensures villages are loaded into IndexedDB
 * If already loaded, returns immediately
 * If not loaded, fetches from bundled JSON and bulk inserts
 *
 * @returns Promise<void>
 */
export async function loadVillagesIfNeeded(): Promise<void> {
  try {
    // Check if villages are already loaded
    const count = await db.villages.count();

    if (count > 0) {
      console.log(`✅ Villages already loaded: ${count} records`);
      return;
    }

    console.log('📥 Loading villages for first time...');
    const startTime = performance.now();

    // Fetch bundled JSON from public directory
    const response = await fetch('/data/villages.json');

    if (!response.ok) {
      throw new Error(`Failed to fetch villages: ${response.statusText}`);
    }

    const villages = await response.json();

    if (!Array.isArray(villages) || villages.length === 0) {
      throw new Error('Invalid villages data format');
    }

    console.log(`📊 Found ${villages.length} villages in file`);

    // Bulk insert to IndexedDB
    await db.villages.bulkPut(villages);

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    // Verify insertion
    const finalCount = await db.villages.count();
    console.log(`✅ Loaded ${finalCount} villages to IndexedDB in ${duration}ms`);

    // Log statistics
    const uniqueDistricts = await db.villages
      .orderBy('District')
      .uniqueKeys();

    console.log(`   📍 Unique districts: ${uniqueDistricts.length}`);

  } catch (error) {
    console.error('❌ Failed to load villages:', error);
    throw new Error(`Village loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get count of loaded villages
 * Useful for checking if villages are loaded
 *
 * @returns Promise<number> Count of villages in IndexedDB
 */
export async function getVillageCount(): Promise<number> {
  return await db.villages.count();
}

/**
 * Clear all village data from IndexedDB
 * Useful for resetting or reloading fresh data
 *
 * @returns Promise<void>
 */
export async function clearVillages(): Promise<void> {
  await db.villages.clear();
  console.log('🗑️ Cleared all village data');
}

/**
 * Reload villages from JSON file
 * Clears existing data and reloads fresh
 *
 * @returns Promise<void>
 */
export async function reloadVillages(): Promise<void> {
  console.log('🔄 Reloading villages...');
  await clearVillages();
  await loadVillagesIfNeeded();
}
