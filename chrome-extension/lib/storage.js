// Clarus — Storage Manager
// Handles usage tracking and monthly reset via chrome.storage.local

const Storage = {
  // Get a value from chrome.storage.local
  async get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    });
  },

  // Set a value in chrome.storage.local
  async set(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  },

  // Remove a key from chrome.storage.local
  async remove(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  },

  // Get current month key (e.g., "2026-01")
  _getMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  },

  // Get usage count for current month
  async getUsageCount() {
    const monthKey = this._getMonthKey();
    const usage = await this.get("usage");
    if (!usage || usage.month !== monthKey) {
      // New month — reset counter
      await this.set("usage", { month: monthKey, count: 0 });
      return 0;
    }
    return usage.count;
  },

  // Increment usage count
  async incrementUsage() {
    const monthKey = this._getMonthKey();
    const usage = await this.get("usage");
    if (!usage || usage.month !== monthKey) {
      await this.set("usage", { month: monthKey, count: 1 });
      return 1;
    }
    const newCount = usage.count + 1;
    await this.set("usage", { month: monthKey, count: newCount });
    return newCount;
  },

  // Get remaining analyses
  async getRemainingAnalyses() {
    const count = await this.getUsageCount();
    return Math.max(0, CONFIG.FREE_ANALYSES_PER_MONTH - count);
  },

  // Check if limit is reached
  async isLimitReached() {
    const count = await this.getUsageCount();
    return count >= CONFIG.FREE_ANALYSES_PER_MONTH;
  },

  // Store the last analysis result for quick re-display
  async setLastResult(tabUrl, result) {
    await this.set("lastResult", { url: tabUrl, result, timestamp: Date.now() });
  },

  // Get last result if it matches the current URL and is fresh (< 1 hour)
  async getLastResult(tabUrl) {
    const data = await this.get("lastResult");
    if (!data) return null;
    if (data.url !== tabUrl) return null;
    if (Date.now() - data.timestamp > 3600000) return null; // 1 hour expiry
    return data.result;
  },
};
