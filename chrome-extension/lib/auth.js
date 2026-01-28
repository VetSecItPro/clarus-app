// Clarus — Auth Manager
// Handles Supabase authentication via chrome.storage.local

const Auth = {
  // Get stored auth tokens
  async getSession() {
    const session = await Storage.get("session");
    if (!session) return null;

    // Check if access token is expired
    if (session.expires_at && Date.now() / 1000 > session.expires_at) {
      // Try to refresh
      const refreshed = await this.refreshSession(session.refresh_token);
      return refreshed;
    }

    return session;
  },

  // Store auth session
  async setSession(session) {
    await Storage.set("session", session);
  },

  // Clear auth session
  async clearSession() {
    await Storage.remove("session");
  },

  // Refresh an expired session using the refresh token
  async refreshSession(refreshToken) {
    if (!refreshToken) {
      await this.clearSession();
      return null;
    }

    try {
      const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        await this.clearSession();
        return null;
      }

      const data = await response.json();
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        user: data.user,
      };

      await this.setSession(session);
      return session;
    } catch (err) {
      console.error("Token refresh failed:", err);
      await this.clearSession();
      return null;
    }
  },

  // Sign in with email/password
  async signIn(email, password) {
    try {
      const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": CONFIG.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const err = await response.json();
        return { error: err.error_description || err.msg || "Sign in failed" };
      }

      const data = await response.json();
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        user: data.user,
      };

      await this.setSession(session);
      return { session };
    } catch (err) {
      return { error: "Network error. Please try again." };
    }
  },

  // Sign out
  async signOut() {
    const session = await this.getSession();
    if (session?.access_token) {
      try {
        await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "apikey": CONFIG.SUPABASE_ANON_KEY,
          },
        });
      } catch (_) {
        // Best effort sign out
      }
    }
    await this.clearSession();
  },

  // Get authorization headers for API calls
  async getAuthHeaders() {
    const session = await this.getSession();
    if (!session?.access_token) return null;
    return {
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": CONFIG.SUPABASE_ANON_KEY,
    };
  },
};
