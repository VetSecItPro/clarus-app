// Clarus — API Client
// Handles content creation, processing, and polling

const Api = {
  // Create a content record in Supabase
  async createContent(url, userId) {
    const headers = await Auth.getAuthHeaders();
    if (!headers) return { error: "Not authenticated" };

    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/content`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        url: url,
        user_id: userId,
        type: this._detectContentType(url),
        processing_status: "pending",
      }),
    });

    if (!response.ok) {
      // Check if content already exists for this user + URL
      const existing = await this.findExistingContent(url, userId);
      if (existing) return { data: existing };
      return { error: "Failed to create content record" };
    }

    const data = await response.json();
    return { data: data[0] || data };
  },

  // Check if content already exists for this URL
  async findExistingContent(url, userId) {
    const headers = await Auth.getAuthHeaders();
    if (!headers) return null;

    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(
      `${CONFIG.SUPABASE_URL}/rest/v1/content?url=eq.${encodedUrl}&user_id=eq.${userId}&select=id,title,url,type,processing_status&order=created_at.desc&limit=1`,
      { headers }
    );

    if (!response.ok) return null;
    const data = await response.json();
    return data[0] || null;
  },

  // Trigger content processing via the website API
  async triggerProcessing(contentId) {
    const session = await Auth.getSession();
    if (!session?.access_token) return { error: "Not authenticated" };

    const response = await fetch(`${CONFIG.SITE_URL}/api/process-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ contentId }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `Processing failed: ${text}` };
    }

    return { success: true };
  },

  // Poll for analysis results (triage + brief_overview)
  async pollForResults(contentId, onProgress) {
    const headers = await Auth.getAuthHeaders();
    if (!headers) return { error: "Not authenticated" };

    let attempts = 0;

    return new Promise((resolve) => {
      const poll = async () => {
        attempts++;

        if (attempts > CONFIG.MAX_POLL_ATTEMPTS) {
          resolve({ error: "Analysis timed out. Please try on the website." });
          return;
        }

        try {
          // Fetch the summary data
          const response = await fetch(
            `${CONFIG.SUPABASE_URL}/rest/v1/summaries?content_id=eq.${contentId}&select=brief_overview,triage,processing_status&order=created_at.desc&limit=1`,
            { headers }
          );

          if (!response.ok) {
            setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
            return;
          }

          const data = await response.json();
          const summary = data[0];

          if (!summary) {
            if (onProgress) onProgress("Waiting for analysis to start...");
            setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
            return;
          }

          // Report progress based on processing_status
          const status = summary.processing_status;
          if (onProgress) {
            if (status?.includes("overview")) onProgress("Generating overview...");
            else if (status?.includes("triage")) onProgress("Evaluating quality...");
            else if (status?.includes("truth")) onProgress("Fact-checking claims...");
            else if (status?.includes("action")) onProgress("Extracting action items...");
            else if (status?.includes("summary") || status?.includes("detailed")) onProgress("Building detailed analysis...");
            else onProgress("Processing content...");
          }

          // We have enough for the teaser when both triage and brief_overview exist
          if (summary.brief_overview && summary.triage) {
            resolve({
              data: {
                brief_overview: summary.brief_overview,
                triage: summary.triage,
              },
            });
            return;
          }

          setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
        } catch (err) {
          console.error("Poll error:", err);
          setTimeout(poll, CONFIG.POLL_INTERVAL_MS);
        }
      };

      poll();
    });
  },

  // Detect content type from URL
  _detectContentType(url) {
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes("x.com") || url.includes("twitter.com")) return "x_post";
    return "article";
  },
};
