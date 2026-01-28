// Clarus — Side Panel Controller
// Manages UI state transitions and user interactions

const Panel = {
  // Current state tracking
  currentState: null,
  currentContentId: null,

  // DOM references (cached on init)
  els: {},

  // Initialize the side panel
  async init() {
    this.cacheElements();
    this.bindEvents();
    await this.checkAuthAndRoute();
  },

  // Cache all DOM elements
  cacheElements() {
    this.els = {
      // States
      stateLoggedOut: document.getElementById("state-logged-out"),
      stateReady: document.getElementById("state-ready"),
      stateProcessing: document.getElementById("state-processing"),
      stateResults: document.getElementById("state-results"),
      stateLimit: document.getElementById("state-limit"),
      // Header
      userInfo: document.getElementById("user-info"),
      userEmail: document.getElementById("user-email"),
      btnSignout: document.getElementById("btn-signout"),
      // Login
      loginForm: document.getElementById("login-form"),
      inputEmail: document.getElementById("input-email"),
      inputPassword: document.getElementById("input-password"),
      btnLogin: document.getElementById("btn-login"),
      loginError: document.getElementById("login-error"),
      btnSignup: document.getElementById("btn-signup"),
      // Ready
      currentUrl: document.getElementById("current-url"),
      btnAnalyze: document.getElementById("btn-analyze"),
      remainingCount: document.getElementById("remaining-count"),
      // Processing
      progressFill: document.getElementById("progress-fill"),
      progressStatus: document.getElementById("progress-status"),
      stepFetch: document.getElementById("step-fetch"),
      stepOverview: document.getElementById("step-overview"),
      stepQuality: document.getElementById("step-quality"),
      stepFacts: document.getElementById("step-facts"),
      // Results
      resultScore: document.getElementById("result-score"),
      scoreFill: document.getElementById("score-fill"),
      resultRecommendation: document.getElementById("result-recommendation"),
      resultOverview: document.getElementById("result-overview"),
      btnFullAnalysis: document.getElementById("btn-full-analysis"),
      resultsRemaining: document.getElementById("results-remaining"),
      // Limit
      limitCount: document.getElementById("limit-count"),
      btnUpgrade: document.getElementById("btn-upgrade"),
      limitReset: document.getElementById("limit-reset"),
    };
  },

  // Bind all event listeners
  bindEvents() {
    // Login form
    this.els.loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Signup button -> opens website signup page
    this.els.btnSignup.addEventListener("click", () => {
      chrome.tabs.create({ url: `${CONFIG.SITE_URL}/signup?source=extension` });
    });

    // Sign out
    this.els.btnSignout.addEventListener("click", () => this.handleSignout());

    // Analyze button
    this.els.btnAnalyze.addEventListener("click", () => this.handleAnalyze());

    // View full analysis
    this.els.btnFullAnalysis.addEventListener("click", () => {
      if (this.currentContentId) {
        chrome.tabs.create({ url: `${CONFIG.SITE_URL}/item/${this.currentContentId}` });
      }
    });

    // Upgrade button
    this.els.btnUpgrade.addEventListener("click", () => {
      chrome.tabs.create({ url: `${CONFIG.SITE_URL}/pricing?source=extension` });
    });
  },

  // Check authentication and route to correct state
  async checkAuthAndRoute() {
    const session = await Auth.getSession();

    if (!session) {
      this.showState("logged-out");
      return;
    }

    // Show user info in header
    this.els.userEmail.textContent = session.user?.email || "";
    this.els.userInfo.classList.remove("hidden");

    // Check usage limit
    const limitReached = await Storage.isLimitReached();
    if (limitReached) {
      this.showLimitState();
      return;
    }

    // Show ready state
    await this.showReadyState();
  },

  // Show a specific UI state
  showState(state) {
    // Hide all states
    const states = ["logged-out", "ready", "processing", "results", "limit"];
    states.forEach((s) => {
      const el = document.getElementById(`state-${s}`);
      if (el) el.classList.add("hidden");
    });

    // Show target state
    const target = document.getElementById(`state-${state}`);
    if (target) target.classList.remove("hidden");
    this.currentState = state;
  },

  // Show ready state with current tab URL
  async showReadyState() {
    this.showState("ready");

    // Get current tab URL
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.url) {
        // Truncate long URLs for display
        const displayUrl = tab.url.length > 80
          ? tab.url.substring(0, 77) + "..."
          : tab.url;
        this.els.currentUrl.textContent = displayUrl;

        // Check for cached result
        const cached = await Storage.getLastResult(tab.url);
        if (cached) {
          this.showResultsState(cached.triage, cached.brief_overview);
          return;
        }
      } else {
        this.els.currentUrl.textContent = "No page detected";
        this.els.btnAnalyze.disabled = true;
      }
    } catch (err) {
      this.els.currentUrl.textContent = "Unable to detect page";
      this.els.btnAnalyze.disabled = true;
    }

    // Show remaining count
    const remaining = await Storage.getRemainingAnalyses();
    this.els.remainingCount.textContent = `${remaining} of ${CONFIG.FREE_ANALYSES_PER_MONTH} free analyses remaining`;
  },

  // Show limit reached state
  async showLimitState() {
    this.showState("limit");
    this.els.limitCount.textContent = CONFIG.FREE_ANALYSES_PER_MONTH;

    // Calculate reset date (first of next month)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    this.els.limitReset.textContent = `Resets on ${monthNames[nextMonth.getMonth()]} ${nextMonth.getDate()}`;
  },

  // Show results state
  showResultsState(triage, briefOverview) {
    this.showState("results");

    const score = triage?.quality_score || 0;
    const signalNoise = triage?.signal_noise_score ?? 2;

    // Score display
    this.els.resultScore.textContent = score;
    this.els.scoreFill.style.width = `${score * 10}%`;

    // Score color
    if (score >= 8) {
      this.els.scoreFill.style.background = "var(--green)";
      this.els.resultScore.style.color = "var(--green)";
    } else if (score >= 6) {
      this.els.scoreFill.style.background = "var(--emerald)";
      this.els.resultScore.style.color = "var(--emerald)";
    } else if (score >= 4) {
      this.els.scoreFill.style.background = "var(--amber)";
      this.els.resultScore.style.color = "var(--amber)";
    } else {
      this.els.scoreFill.style.background = "var(--red)";
      this.els.resultScore.style.color = "var(--red)";
    }

    // Recommendation based on signal_noise_score
    const recommendations = [
      { label: "Skip", class: "skip" },
      { label: "Skim", class: "skim" },
      { label: "Worth It", class: "worth-it" },
      { label: "Must See", class: "must-see" },
    ];
    const rec = recommendations[signalNoise] || recommendations[1];
    this.els.resultRecommendation.textContent = rec.label;
    this.els.resultRecommendation.className = `recommendation ${rec.class}`;

    // Overview text
    this.els.resultOverview.textContent = briefOverview || "Analysis complete. View full details on the website.";

    // Remaining count
    Storage.getRemainingAnalyses().then((remaining) => {
      this.els.resultsRemaining.textContent = `${remaining} of ${CONFIG.FREE_ANALYSES_PER_MONTH} free analyses remaining`;
    });
  },

  // Handle login
  async handleLogin() {
    const email = this.els.inputEmail.value.trim();
    const password = this.els.inputPassword.value;

    if (!email || !password) {
      this.showLoginError("Please enter email and password.");
      return;
    }

    this.els.btnLogin.disabled = true;
    this.els.btnLogin.textContent = "Signing in...";
    this.els.loginError.classList.add("hidden");

    const result = await Auth.signIn(email, password);

    if (result.error) {
      this.showLoginError(result.error);
      this.els.btnLogin.disabled = false;
      this.els.btnLogin.textContent = "Log In";
      return;
    }

    // Success - update UI
    this.els.userEmail.textContent = result.session.user?.email || "";
    this.els.userInfo.classList.remove("hidden");
    this.els.btnLogin.disabled = false;
    this.els.btnLogin.textContent = "Log In";
    this.els.inputPassword.value = "";

    // Check limit and route
    const limitReached = await Storage.isLimitReached();
    if (limitReached) {
      this.showLimitState();
    } else {
      await this.showReadyState();
    }
  },

  // Show login error
  showLoginError(message) {
    this.els.loginError.textContent = message;
    this.els.loginError.classList.remove("hidden");
  },

  // Handle sign out
  async handleSignout() {
    await Auth.signOut();
    this.els.userInfo.classList.add("hidden");
    this.showState("logged-out");
  },

  // Handle analyze button click
  async handleAnalyze() {
    // Check limit first
    const limitReached = await Storage.isLimitReached();
    if (limitReached) {
      this.showLimitState();
      return;
    }

    // Get current tab URL
    let tabUrl;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabUrl = tab?.url;
    } catch (err) {
      return;
    }

    if (!tabUrl || tabUrl.startsWith("chrome://") || tabUrl.startsWith("chrome-extension://")) {
      this.els.currentUrl.textContent = "Cannot analyze browser pages. Navigate to a website first.";
      return;
    }

    // Show processing state
    this.showState("processing");
    this.resetProgressSteps();
    this.setProgress(10, "Fetching content...");
    this.activateStep("step-fetch");

    const session = await Auth.getSession();
    if (!session?.user?.id) {
      this.showState("logged-out");
      return;
    }

    try {
      // Step 1: Create content record
      const { data: content, error: createError } = await Api.createContent(tabUrl, session.user.id);
      if (createError) {
        this.showError(createError);
        return;
      }

      this.currentContentId = content.id;
      this.completeStep("step-fetch");
      this.setProgress(25, "Generating overview...");
      this.activateStep("step-overview");

      // Step 2: Trigger processing (if not already processed)
      if (content.processing_status === "pending" || !content.processing_status) {
        const { error: processError } = await Api.triggerProcessing(content.id);
        if (processError) {
          this.showError(processError);
          return;
        }
      }

      this.setProgress(35, "Processing content...");

      // Step 3: Poll for results
      const { data: results, error: pollError } = await Api.pollForResults(
        content.id,
        (status) => this.handleProgressUpdate(status)
      );

      if (pollError) {
        this.showError(pollError);
        return;
      }

      // Increment usage
      await Storage.incrementUsage();

      // Cache results
      await Storage.setLastResult(tabUrl, results);

      // Show results
      this.completeStep("step-facts");
      this.setProgress(100, "Complete!");

      // Brief delay for visual satisfaction
      await new Promise((r) => setTimeout(r, 500));

      this.showResultsState(results.triage, results.brief_overview);
    } catch (err) {
      console.error("Analysis error:", err);
      this.showError("Something went wrong. Please try again.");
    }
  },

  // Progress helpers
  setProgress(percent, status) {
    this.els.progressFill.style.width = `${percent}%`;
    if (status) this.els.progressStatus.textContent = status;
  },

  resetProgressSteps() {
    ["step-fetch", "step-overview", "step-quality", "step-facts"].forEach((id) => {
      const el = document.getElementById(id);
      el.className = "step";
    });
  },

  activateStep(stepId) {
    document.getElementById(stepId).className = "step active";
  },

  completeStep(stepId) {
    document.getElementById(stepId).className = "step done";
  },

  handleProgressUpdate(status) {
    if (status.includes("overview") || status.includes("Generating")) {
      this.setProgress(40, status);
      this.completeStep("step-fetch");
      this.activateStep("step-overview");
    } else if (status.includes("quality") || status.includes("Evaluating") || status.includes("triage")) {
      this.setProgress(55, status);
      this.completeStep("step-overview");
      this.activateStep("step-quality");
    } else if (status.includes("Fact") || status.includes("truth") || status.includes("claims")) {
      this.setProgress(70, status);
      this.completeStep("step-quality");
      this.activateStep("step-facts");
    } else if (status.includes("action") || status.includes("detailed") || status.includes("summary")) {
      this.setProgress(85, status);
    } else {
      this.setProgress(45, status);
    }
  },

  // Show error and return to ready state
  showError(message) {
    // Show in processing state briefly, then return to ready
    this.els.progressStatus.textContent = message;
    this.els.progressStatus.style.color = "var(--red)";
    this.els.progressFill.style.background = "var(--red)";

    setTimeout(async () => {
      this.els.progressStatus.style.color = "";
      this.els.progressFill.style.background = "";
      await this.showReadyState();
    }, 3000);
  },
};

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => Panel.init());
