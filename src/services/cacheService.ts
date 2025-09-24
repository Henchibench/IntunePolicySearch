import { Policy } from "@/types/graph";

const CACHE_KEY = 'intune-policies-cache';
const CACHE_TIMESTAMP_KEY = 'intune-policies-cache-timestamp';
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export class CacheService {
  /**
   * Save policies to localStorage with timestamp
   */
  static savePolicies(policies: Policy[]): void {
    try {
      const cacheData = {
        policies,
        timestamp: Date.now()
      };
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log(`Cached ${policies.length} policies to localStorage`);
    } catch (error) {
      console.error('Failed to save policies to cache:', error);
    }
  }

  /**
   * Load policies from localStorage if cache is still valid
   */
  static loadPolicies(): Policy[] | null {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      
      if (!cachedData) {
        console.log('No cached policies found');
        return null;
      }

      const { policies, timestamp } = JSON.parse(cachedData);
      const now = Date.now();
      const cacheAge = now - timestamp;

      if (cacheAge > CACHE_DURATION) {
        console.log(`Cache expired (${Math.round(cacheAge / 1000 / 60)} minutes old), removing`);
        this.clearCache();
        return null;
      }

      console.log(`Loaded ${policies.length} policies from cache (${Math.round(cacheAge / 1000 / 60)} minutes old)`);
      return policies;
    } catch (error) {
      console.error('Failed to load policies from cache:', error);
      this.clearCache();
      return null;
    }
  }

  /**
   * Clear the cache
   */
  static clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY);
      console.log('Cache cleared');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }

  /**
   * Check if cache exists and is valid
   */
  static isCacheValid(): boolean {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      
      if (!cachedData) {
        return false;
      }

      const { timestamp } = JSON.parse(cachedData);
      const now = Date.now();
      const cacheAge = now - timestamp;

      return cacheAge <= CACHE_DURATION;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache info for display
   */
  static getCacheInfo(): { exists: boolean; age: number; count: number } | null {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      
      if (!cachedData) {
        return null;
      }

      const { policies, timestamp } = JSON.parse(cachedData);
      const now = Date.now();
      const cacheAge = now - timestamp;

      return {
        exists: true,
        age: Math.round(cacheAge / 1000 / 60), // age in minutes
        count: policies.length
      };
    } catch (error) {
      return null;
    }
  }
}
