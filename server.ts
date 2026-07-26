import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as cheerio from "cheerio";
import cors from "cors";
import https from "https";
import http from "http";
import crypto from "crypto";

dotenv.config();

// Path helpers for ES modules compatibility
const resolvedFilename = typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : "";
const resolvedDirname = resolvedFilename ? path.dirname(resolvedFilename) : "";

// Initialize Supabase Admin for sensitive operations
let supabaseAdmin: any = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      console.warn("Supabase credentials missing (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)");
      return null;
    }
    supabaseAdmin = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseAdmin;
}

function parseBillingCycle(cycle: any): string {
  if (!cycle) return "monthly";
  
  if (typeof cycle === "string") {
    const trimmed = cycle.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseBillingCycle(parsed);
      } catch (e) {
        // Not valid JSON, fallback to string checks
      }
    }
    
    const lower = trimmed.toLowerCase();
    if (lower.includes("year") || lower === "yearly" || lower === "annually" || lower === "annual" || lower === "yr") {
      return "yearly";
    }
    return "monthly";
  }
  
  if (typeof cycle === "object") {
    const intervalVal = cycle.interval || cycle.Interval || "";
    const frequencyVal = cycle.frequency || cycle.Frequency;
    const interval = String(intervalVal).toLowerCase();
    const frequency = frequencyVal ? Number(frequencyVal) : 1;
    if (interval.includes("year") || interval === "yearly" || interval === "annually" || interval === "annual" || interval === "yr") {
      return "yearly";
    }
    if (interval.includes("month") && frequency === 12) {
      return "yearly";
    }
  }
  
  return "monthly";
}

// ============================================
// IMPROVED FETCH WITH RETRIES AND TIMEOUT
// ============================================

async function fetchWithRetry(url: string, maxRetries = 3, timeout = 25000): Promise<string> {
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`[Fetch Attempt ${attempt + 1}/${maxRetries}] ${url}`);

      // Create custom agent to handle network issues
      const isHttps = url.startsWith('https');
      const agent = isHttps 
        ? new https.Agent({ 
            timeout,
            rejectUnauthorized: false, // Allow self-signed certs
            keepAlive: true
          })
        : new http.Agent({ 
            timeout,
            keepAlive: true
          });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none'
          },
          signal: controller.signal,
          // @ts-ignore - Node.js fetch supports agent
          agent
        });

        clearTimeout(timeoutId);

        console.log(`[Fetch Success] Status: ${response.status}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type') || '';
        
        // Only accept text content types
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml') && !contentType.includes('text/plain')) {
          throw new Error(`Invalid content type: ${contentType}`);
        }

        const html = await response.text();

        if (!html || html.length < 100) {
          throw new Error(`Response too small: ${html.length} bytes`);
        }

        return html;

      } finally {
        clearTimeout(timeoutId);
      }

    } catch (error: any) {
      lastError = error;
      console.error(`[Fetch Failed] Attempt ${attempt + 1}:`, error.message);

      // Don't retry on specific errors
      if (error.message.includes('403') || error.message.includes('401')) {
        console.log('Access denied - not retrying');
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  }

  // All retries exhausted
  throw new Error(`Failed to fetch after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`);
}

// ============================================
// IMPROVED TEXT EXTRACTION
// ============================================

function extractTextFromHTML(html: string): string {
  try {
    const $ = cheerio.load(html);
    
    // Remove non-content elements
    $('script, style, nav, footer, header, aside, noscript, [style*="display:none"], [style*="display: none"]').remove();
    
    // Try specific content areas first
    let contentArea = $('article, main, [role="main"], .main-content, .content, .post-content, #content, .privacy-policy, .terms, [data-testid*="content"]');
    
    if (contentArea.length === 0) {
      // Fallback to body
      contentArea = $('body');
    }
    
    // Extract text and clean up
    let text = contentArea.text();
    
    // Normalize whitespace
    text = text
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/\n\n+/g, '\n') // Multiple newlines to single
      .trim();
    
    return text;
  } catch (error: any) {
    console.error('Error extracting text from HTML:', error);
    return '';
  }
}

// ============================================
// EXTRACT EFFECTIVE/LAST UPDATED DATE
// ============================================

async function extractEffectiveDate(text: string, siteUrl: string, apiKey: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
          'Referer': 'https://ais-dev-2qrvrtc44lvwefolakcjbw-179585477098.europe-west1.run.app'
        }
      }
    });
    const prompt = `
      You are an assistant. Extract or determine the "Last Updated", "Last Update", "Effective Date", "Revision Date" or equivalent date when this policy or term of service was updated/published.
      
      Look carefully at the provided text preview, and also use Google Search to verify the policy page for this URL if the text is sparse or missing.
      
      Text Preview:
      ${text.substring(0, 5000)}
      
      Website URL: ${siteUrl}
      
      Return ONLY the extracted date string (e.g. "January 1, 2024", "2023-11-15", etc.) or "Unknown" if not found. Do NOT add any extra explanations or words. Just return the date or "Unknown".
    `;
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        tools: [{ googleSearch: {} }]
      }
    });
    return (response.text || "").trim().substring(0, 50);
  } catch (e) {
    console.error("Error extracting effective date:", e);
    return "Unknown";
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // ✅ CORS CONFIGURATION - Enable for Chrome Extension
  app.use(cors({
    origin: (origin, callback) => {
      // Allow any origin, including chrome-extension:// and local/deployment URLs
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
  }));

  // ✅ JSON and TEXT parsing with 50MB limit
  app.use(express.json({ limit: '50mb' }));
  app.use(express.text({ limit: '50mb' }));

  // ✅ Serve Chrome Extension folder statically
  app.use("/chrome-extension", express.static(path.join(process.cwd(), "chrome-extension")));

  // ✅ Request logger for debugging integration issues
  app.use((req, res, next) => {
    const logMsg = `[${new Date().toISOString()}] ${req.method} ${req.url} - Headers: ${JSON.stringify(req.headers)}\n`;
    try {
      fs.appendFileSync(path.join(process.cwd(), "request_log.txt"), logMsg);
    } catch (e) {
      console.error("Failed to write request log:", e);
    }
    next();
  });



  // Middleware to verify Supabase User
  const authenticateUser = async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ 
          error: "Missing authorization header",
          code: "AUTH_FAILED"
        });
      }

      const token = authHeader.split(" ")[1];
      if (!token || token === "undefined" || token === "null") {
        return res.status(401).json({ 
          error: "Invalid or missing token string",
          code: "AUTH_FAILED"
        });
      }

      const admin = getSupabaseAdmin();
      
      if (!admin) {
        console.warn("Supabase Admin not configured. Using mock user.");
        req.user = { id: "demo-user-id", email: "demo@example.com" };
        return next();
      }

      try {
        const { data: { user }, error } = await admin.auth.getUser(token);
        if (error || !user) {
          console.error("Auth verification failed:", JSON.stringify(error, null, 2));
          return res.status(401).json({ 
            error: "Invalid or expired session. Please refresh the page or login again.",
            code: "AUTH_FAILED",
            details: error?.message 
          });
        }
        req.user = user;
        next();
      } catch (err: any) {
        console.error("Auth middleware unexpected error:", err);
        return res.status(500).json({ 
          error: "Internal Auth Error", 
          code: "AUTH_ERROR",
          details: err.message 
        });
      }
    } catch (err: any) {
      console.error("Unexpected error in authenticateUser:", err);
      return res.status(500).json({ 
        error: "Authentication failed",
        code: "AUTH_ERROR"
      });
    }
  };

  // Profile Management
  app.get("/api/profile", authenticateUser, async (req: any, res) => {
    try {
      const admin = getSupabaseAdmin();
      
      const userFirstName = req.user?.user_metadata?.first_name || "";
      const userLastName = req.user?.user_metadata?.last_name || "";
      const userFullName = req.user?.user_metadata?.full_name || `${userFirstName} ${userLastName}`.trim() || req.user?.user_metadata?.name || (req.user?.email ? req.user.email.split('@')[0] : "User");
      const userEmail = req.user?.email || "";

      // Default/Fallback profile
      const fallbackProfile = { 
        id: req.user.id, 
        email: userEmail,
        first_name: userFirstName,
        last_name: userLastName,
        full_name: userFullName,
        plan: "free", 
        analyses_count: 0, 
        preferences: null,
        is_demo: !admin 
      };

      if (!admin) {
        return res.json(fallbackProfile);
      }
      
      try {
        // 1. Fetch main profile (Safe fetch - default to free if table missing)
        let profile = null;
        const { data: profileData, error: profileError } = await admin
          .from("profiles")
          .select("*")
          .eq("id", req.user.id)
          .single();

        if (!profileError && profileData) {
          profile = { ...profileData };
          // Parse smart plan string if it exists (e.g. "pro_yearly" or "pro-yearly")
          const planStr = String(profile.plan || "");
          if (planStr.includes("_") || planStr.includes("-")) {
            const separator = planStr.includes("_") ? "_" : "-";
            const [basePlan, cycle] = planStr.split(separator);
            profile.plan = basePlan;
            profile.billing_cycle = cycle;
          } else {
            if (profile.plan === "pro") {
              profile.billing_cycle = profile.billing_cycle || "monthly";
            } else {
              profile.billing_cycle = null;
            }
          }
          if (profile.plan === "free") {
            profile.billing_cycle = null;
          } else if (profile.billing_cycle) {
            profile.billing_cycle = parseBillingCycle(profile.billing_cycle);
          }
        } else if (profileError && profileError.code !== "PGRST116" && profileError.code !== "42P01") {
          console.error("Profile Fetch Error Details:", JSON.stringify(profileError, null, 2));
        }

        // 2. Fetch user preferences from the specialized table
        const { data: userPrefs, error: prefsError } = await admin
          .from("user_preferences")
          .select("*")
          .eq("user_id", req.user.id)
          .single();

        if (prefsError && prefsError.code !== "PGRST116" && prefsError.code !== "42P01") {
          console.error("Preferences Fetch Error:", prefsError);
        }

        // Map DB arrays back to UI format if they exist
        let mappedPrefs = null;
        if (userPrefs) {
          mappedPrefs = {
            pp: [
              ...userPrefs.accepted_privacy_elements.map((id: string) => ({ id, checked: true })),
              ...userPrefs.declined_privacy_elements.map((id: string) => ({ id, checked: false }))
            ],
            tc: [
              ...userPrefs.accepted_terms_elements.map((id: string) => ({ id, checked: true })),
              ...userPrefs.declined_terms_elements.map((id: string) => ({ id, checked: false }))
            ]
          };
        }

        const finalProfile = profile || fallbackProfile;
        finalProfile.email = userEmail;
        finalProfile.first_name = profile?.first_name || userFirstName;
        finalProfile.last_name = profile?.last_name || userLastName;
        finalProfile.full_name = profile?.full_name || profile?.name || `${finalProfile.first_name} ${finalProfile.last_name}`.trim() || userFullName;
        if (profile) {
          (finalProfile as any)._debug_raw_profile = profileData;
        }
        console.log("[Profile API Debug] Serving profile:", JSON.stringify(finalProfile));
        finalProfile.preferences = mappedPrefs;

        // Lazy init profile if missing (Only if table exists)
        if (!profile) {
          try {
            await admin.from("profiles").insert([{ id: req.user.id, plan: "free", analyses_count: 0 }]);
          } catch (e) {
            // Silent fail - likely missing table
          }
        }

        res.json(finalProfile);
      } catch (error: any) {
        console.error("Profile API Error:", error);
        res.json(fallbackProfile);
      }
    } catch (err: any) {
      console.error("Unexpected error in /api/profile:", err);
      return res.status(500).json({ 
        error: "Failed to fetch profile",
        code: "PROFILE_ERROR"
      });
    }
  });

  app.post("/api/profile/preferences", authenticateUser, async (req: any, res) => {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) return res.json({ success: true, message: "Demo mode: Preferences not saved" });

      try {
        const { preferences } = req.body;
        if (!preferences || !preferences.pp || !preferences.tc) {
          return res.status(400).json({ error: "Invalid preferences format" });
        }

        // Check if user is Pro
        const { data: profile } = await admin
          .from("profiles")
          .select("plan")
          .eq("id", req.user.id)
          .single();

        const basePlan = String(profile?.plan || "free");
        const isPro = !basePlan.startsWith("free");

        if (!isPro) {
          return res.status(403).json({ 
            error: "Custom preference matching is restricted to Professional plan users.",
            code: "RESTRICTED_FEATURE"
          });
        }

        const accepted_privacy_elements = preferences.pp.filter((p: any) => p.checked).map((p: any) => p.id);
        const declined_privacy_elements = preferences.pp.filter((p: any) => !p.checked).map((p: any) => p.id);
        const accepted_terms_elements = preferences.tc.filter((p: any) => p.checked).map((p: any) => p.id);
        const declined_terms_elements = preferences.tc.filter((p: any) => !p.checked).map((p: any) => p.id);

        const { error } = await admin
          .from("user_preferences")
          .upsert({
            user_id: req.user.id,
            accepted_privacy_elements,
            declined_privacy_elements,
            accepted_terms_elements,
            declined_terms_elements,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) throw error;
        res.json({ success: true });
      } catch (error: any) {
        console.error("Save Preferences Error:", error);
        return res.status(500).json({ error: "Failed to save preferences" });
      }
    } catch (err: any) {
      console.error("Unexpected error in /api/profile/preferences:", err);
      return res.status(500).json({ 
        error: "Failed to save preferences",
        code: "PREFS_ERROR"
      });
    }
  });

  // ✅ UPDATE USER PROFILE (First Name, Last Name)
  app.post("/api/profile/update", authenticateUser, async (req: any, res) => {
    try {
      const { firstName, lastName } = req.body;
      const admin = getSupabaseAdmin();

      const fName = (firstName || "").trim();
      const lName = (lastName || "").trim();
      const fullName = `${fName} ${lName}`.trim();

      if (admin) {
        // 1. Update Supabase User Metadata
        try {
          await admin.auth.admin.updateUserById(req.user.id, {
            user_metadata: {
              first_name: fName,
              last_name: lName,
              full_name: fullName
            }
          });
        } catch (e) {
          console.warn("Failed to update user_metadata in auth.admin:", e);
        }

        // 2. Update Profiles table if exists
        try {
          await admin.from("profiles").upsert({
            id: req.user.id,
            first_name: fName,
            last_name: lName,
            full_name: fullName,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } catch (e) {
          console.warn("Failed to update profiles table:", e);
        }
      }

      res.json({ 
        success: true, 
        message: "Profile updated successfully!",
        first_name: fName, 
        last_name: lName, 
        full_name: fullName 
      });
    } catch (err: any) {
      console.error("Profile update error:", err);
      res.status(500).json({ error: err.message || "Failed to update profile" });
    }
  });

  // ✅ CHANGE PASSWORD
  app.post("/api/profile/change-password", authenticateUser, async (req: any, res) => {
    try {
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long." });
      }

      const admin = getSupabaseAdmin();
      if (!admin) {
        return res.status(400).json({ error: "Password updates require configured database credentials." });
      }

      const { error } = await admin.auth.admin.updateUserById(req.user.id, {
        password: newPassword
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      res.json({ success: true, message: "Password updated successfully!" });
    } catch (err: any) {
      console.error("Change password error:", err);
      res.status(500).json({ error: err.message || "Failed to change password" });
    }
  });

  // ============================================
  // AI SUMMARIZATION ENDPOINT - IMPROVED NETWORK HANDLING
  // ============================================
  app.post("/api/summarize", authenticateUser, async (req: any, res) => {
    try {
      const admin = getSupabaseAdmin();
      let { text, siteUrl } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ 
          error: "Gemini API key is not configured.",
          code: "CONFIG_ERROR"
        });
      }

      // Determine if we should attempt a server-side fetch
      // If we have substantial text from the browser (>1000 chars), we don't need to scrape
      const isPlaceholder = text?.includes("This is a sample privacy policy text");
      const isMissingVisibleContent = !text || text.trim().length < 500;
      let scrapingSuccess = false;
      
      if (text && text.trim().length >= 500 && !isPlaceholder) {
        scrapingSuccess = true;
      }
      
      if (isPlaceholder || (isMissingVisibleContent && siteUrl && siteUrl.startsWith('http') && siteUrl !== "Manual Paste")) {
        try {
          console.log(`[Scraping Fallback] Attempting to fetch: ${siteUrl}`);
          
          // Use improved fetch with 2 retries and 8s timeout to prevent proxy timeout issues
          const html = await fetchWithRetry(siteUrl, 2, 8000);
          
          // Extract text from HTML
          const scrapedText = extractTextFromHTML(html);
          
          if (scrapedText.length > 200) {
            console.log(`[Scraping Success] Extracted ${scrapedText.length} characters`);
            text = scrapedText;
            scrapingSuccess = true;
          } else {
            console.warn("[Scraping] Extracted too little text, Gemini will need to search.");
          }
        } catch (fetchErr: any) {
          console.error("[Scraping Failed]", fetchErr.message);
          console.log('Continuing to AI analysis; Search Grounding will be used as fallback.');
        }
      }

      // If we have absolutely no text and no URL, we can't do much
      if (!text && (!siteUrl || siteUrl === "Manual Paste")) {
        return res.status(400).json({ 
          error: "No website content provided for analysis. Please enter a valid URL or paste the policy text directly.",
          code: "MISSING_CONTENT"
        });
      }

      // If text is still empty or very short, provide a placeholder for the prompt
      if (!text || text.trim().length < 10) {
        text = "[Note: Content extraction failed. Please search for the policy terms for this site.]";
      }

      let isPro = true;
      let analyses_count = 0;
      let user_preferences: any = {};
      let billingCycle = "monthly";

      // 1. Fetch profile first to determine plan and tier (for accurate limits and preferences if needed)
      if (admin) {
        try {
          const { data: profile, error: profileError } = await admin
            .from("profiles")
            .select("*")
            .eq("id", req.user.id)
            .single();

          if (profileError && profileError.code !== "PGRST116" && profileError.code !== "42P01") {
            throw profileError;
          }

          if (profile) {
            let basePlan = profile.plan || "free";
            billingCycle = profile.billing_cycle ? parseBillingCycle(profile.billing_cycle) : "monthly";
            
            const planStr = String(basePlan);
            if (planStr.includes("_") || planStr.includes("-")) {
              const separator = planStr.includes("_") ? "_" : "-";
              const [extractedPlan, extractedCycle] = planStr.split(separator);
              basePlan = extractedPlan;
              billingCycle = extractedCycle;
            }
            
            isPro = basePlan !== "free";
            analyses_count = profile.analyses_count || 0;
          }
        } catch (dbError: any) {
          console.error("Database error looking up profile in /api/summarize:", dbError);
        }
      }

      // 2. CHECK EXISTING CACHED SCANS FOR THIS URL
      let existingScan: any = null;
      const isRealUrl = siteUrl && siteUrl.startsWith("http") && siteUrl !== "Manual Paste";
      
      if (admin && isRealUrl) {
        try {
          const { data } = await admin
            .from("scans")
            .select("*")
            .eq("user_id", req.user.id)
            .eq("site_url", siteUrl)
            .order("created_at", { ascending: false })
            .limit(1);
          if (data && data.length > 0) {
            existingScan = data[0];
          }
        } catch (err) {
          console.error("Error checking existing scan history:", err);
        }
      }

      let changeDetected = false;
      let newEffectiveDate = "Unknown";
      let forceReanalyze = false;

      if (existingScan && isRealUrl) {
        const lastScanDate = new Date(existingScan.created_at);
        const fourMonthsAgo = new Date();
        fourMonthsAgo.setMonth(fourMonthsAgo.getMonth() - 4);
        const fourMonthsPassed = lastScanDate < fourMonthsAgo;

        if (!fourMonthsPassed) {
          // CASE 1: Successfully scanned within the last 4 months - serve from cache directly, no AI or token consumption!
          return res.status(200).json({ 
            summary: existingScan.summary,
            isPro,
            priority: isPro,
            scrapingSuccess: true,
            timestamp: existingScan.created_at,
            cached: true,
            message: "This site was already analyzed recently (within 4 months). Serving cached results to conserve tokens."
          });
        } else if (!isPro) {
          // CASE 1.5: Over 4 months old, but user is FREE - they do not get change detection / alert checks. Give standard cache with limitation payload.
          return res.status(200).json({ 
            summary: existingScan.summary,
            isPro,
            priority: isPro,
            scrapingSuccess: true,
            timestamp: existingScan.created_at,
            cached: true,
            changeDetectionRestricted: true,
            message: "This site was analyzed over 4 months ago. Upgrade to Professional to trigger change detection & alerts."
          });
        } else {
          // CASE 2: Over 4 months old, so we perform lightweight change detection
          console.log(`[Change Detection] Over 4 months since last scan of: ${siteUrl}. Checking effective date...`);
          newEffectiveDate = await extractEffectiveDate(text, siteUrl, apiKey);
          const oldEffectiveDate = existingScan.summary?.effective_date || "Unknown";

          console.log(`[Change Detection] Old: ${oldEffectiveDate} | New: ${newEffectiveDate}`);

          if (newEffectiveDate === oldEffectiveDate && oldEffectiveDate !== "Unknown") {
            // No changes detected! Reset the 4-month timer by updating the timestamp
            try {
              await admin
                .from("scans")
                .update({ created_at: new Date().toISOString() })
                .eq("id", existingScan.id);
            } catch (dbErr) {
              console.error("Failed to reset scan timer in DB:", dbErr);
            }

            return res.status(200).json({
              summary: existingScan.summary,
              isPro,
              priority: isPro,
              scrapingSuccess,
              timestamp: new Date().toISOString(),
              cached: false,
              changeDetected: false,
              message: `No changes detected! The legal policy of ${siteUrl} was last updated on ${oldEffectiveDate}, which is unchanged. Saved extra model tokens.`
            });
          } else {
            // A change has occurred! We must run full Gemini analysis
            console.log(`[Change Detection] Date changed or unknown! Standard AI re-analysis needed.`);
            changeDetected = true;
            forceReanalyze = true;
          }
        }
      }

      // 3. IF NEW ANALYSIS IS NEEDED (FIRST SCAN OR DATE UPDATED) -> VALIDATE LIMITS AND GET PREFERENCES
      if (admin && (!existingScan || forceReanalyze)) {
        // Enforce user plan limits
        if (!isPro) {
          if (analyses_count >= 5) {
            return res.status(429).json({ 
              error: "Monthly limit reached (5 scans). Please upgrade to the Professional plan for more scans, or wait until the next month.", 
              code: "LIMIT_REACHED" 
            });
          }
        } else {
          if (billingCycle === "yearly") {
            if (analyses_count >= 1200) {
              return res.status(429).json({
                error: "Yearly plan limit reached (1200 scans). Please wait until your subscription renews next year for more scans.",
                code: "LIMIT_REACHED"
              });
            }
          } else {
            if (analyses_count >= 100) {
              return res.status(429).json({
                error: "Monthly plan limit reached (100 scans). Please wait until next month for more scans.",
                code: "LIMIT_REACHED"
              });
            }
          }
        }

        // Fetch custom user preferences (Pro only)
        try {
          if (isPro) {
            const { data: prefsData } = await admin
              .from("user_preferences")
              .select("*")
              .eq("user_id", req.user.id)
              .single();
            
            if (prefsData) {
              user_preferences = {
                accepted_privacy: prefsData.accepted_privacy_elements,
                declined_privacy: prefsData.declined_privacy_elements,
                accepted_terms: prefsData.accepted_terms_elements,
                declined_terms: prefsData.declined_terms_elements
              };
            }
          } else {
            user_preferences = {};
          }
        } catch (prefsErr) {
          console.error("Error fetching preferences:", prefsErr);
        }
      }

      try {
        const ai = new GoogleGenAI({ 
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
              'Referer': 'https://ais-dev-2qrvrtc44lvwefolakcjbw-179585477098.europe-west1.run.app'
            }
          }
        });
        const modelId = isPro ? "gemini-3.1-pro-preview" : "gemini-3.5-flash";
        const detailLevel = isPro ? "exhaustive and granular" : "high-level and basic";

        const prompt = `
          You are "Termsreader", a legal technology assistant. 
          Analyze the following text from a website's term/privacy policy: ${siteUrl}
          
          Website Content (Extracted from Browser/Scraper):
          ${text.substring(0, 50000)}

          User's Privacy & Terms Preferences (Affirmative):
          - ACCEPTED Privacy Elements: ${JSON.stringify(user_preferences.accepted_privacy || [])}
          - DECLINED Privacy Elements: ${JSON.stringify(user_preferences.declined_privacy || [])}
          - ACCEPTED Terms Elements: ${JSON.stringify(user_preferences.accepted_terms || [])}
          - DECLINED Terms Elements: ${JSON.stringify(user_preferences.declined_terms || [])}

          IMPORTANT TASK: 
          1. Use the provided Website Content and your internal Google Search tool to find and verify the official privacy policy or terms of service for this URL.
          2. If the provided Content is sparse, contains CAPTHCA warnings, or seems like an error page, you MUST use Google Search to find the actual legal terms.
          3. CRITICAL HALLUCINATION PREVENTION: If the domain requested (${siteUrl}) is completely non-existent, unregistered, or has no web presence at all, and you cannot find any verified official privacy policy, terms, or reputable discussion/mentions of this exact service via Google Search, you MUST NOT make up placeholder, fictitious rules.
             Instead, if no verified official policy or content exists for this domain, return an empty "summary_points" array [], set "risk_score" to 0, write in "verdict" exactly: "The request site ${siteUrl} is unreachable or doesn't have a verified online privacy policy. Please switch to the 'Manual Text' option and paste its content directly.", and set "effective_date" to "Unknown".
             However, if the domain is a real, live service (such as Hairlax or other actual businesses) but the scraped Website Content is sparse/blank (which is common for modern dynamic Single Page Apps), you MUST use Google Search to find and retrieve the correct privacy policy or terms details, and perform the standard analysis. Do not mark active, real businesses as unreachable.
          4. Extract or determine the "Last update", "Last updated", "Effective date", or "Revision date" of the document. Look for labels like "Last updated: ...", "Last update: ...", "Effective Date: ...", "Version: ...", etc. Be diligent.
          5. Provide a ${detailLevel} summary of the key legal points.
          6. For each point, determine if it matches or conflicts with the user's preferences.
          
          Return ONLY valid JSON in the following format:
          {
            "summary_points": [
              {
                "category": "Privacy" | "Terms" | "Data" | "Legal",
                "point": "Short descriptive text",
                "detail": "Longer explanation of the implication",
                "status": "accepted" | "conflict" | "neutral",
                "impact": "low" | "medium" | "high"
              }
            ],
            "risk_score": 0-100,
            "verdict": "A short summary sentence",
            "effective_date": "YYYY-MM-DD or Month DD, YYYY or Unknown"
          }

          Status logic:
          - "accepted": Matches one of the user's "ACCEPTED" elements.
          - "conflict": Matches one of the user's "DECLINED" elements or contains predatory terms (forced arbitration, hidden fees, data selling) the user didn't explicitly accept.
          - "neutral": Important information not directly covered by specific preferences.
        `;

        const response = await ai.models.generateContent({
          model: modelId,
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            tools: [{ googleSearch: {} }],
          }
        });
        
        const responseText = response.text;
        if (!responseText) {
          throw new Error("AI returned empty response");
        }
        
        // Extract JSON using a more robust regex-based approach
        let cleanedResponse = responseText.replace(/```json\s*/gi, '').replace(/```\s*$/g, '').trim();
        
        let jsonContent = cleanedResponse;
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
        
        const summaryData = JSON.parse(jsonContent);

        // Extract effective_date directly from the AI response JSON, or use fallback
        if (summaryData.effective_date && summaryData.effective_date !== "Unknown") {
          newEffectiveDate = summaryData.effective_date;
        } else if (isRealUrl && (!newEffectiveDate || newEffectiveDate === "Unknown")) {
          newEffectiveDate = await extractEffectiveDate(text, siteUrl, apiKey);
        }
        summaryData.effective_date = newEffectiveDate;

        // Save to scans table for history and change detection
        if (admin) {
          try {
            await admin.from("scans").insert([{
              user_id: req.user.id,
              site_url: siteUrl,
              summary: summaryData
            }]);

            // 2. Increment analysis count
            await admin
              .from("profiles")
              .update({ analyses_count: analyses_count + 1 })
              .eq("id", req.user.id);
          } catch (dbErr) {
            console.error("Database update error (summarize):", dbErr);
            // Don't fail the request if database update fails
          }
        }

         // ✅ ALWAYS return JSON with proper status
         return res.status(200).json({ 
           summary: summaryData,
           isPro,
           priority: isPro,
           scrapingSuccess,
           timestamp: new Date().toISOString(),
           changeDetected: existingScan ? changeDetected : false,
           effective_date: newEffectiveDate
         });

      } catch (aiError: any) {
        console.error("AI Generation Error:", aiError.message);
        
        let friendlyError = aiError.message || "Unknown error";
        if (friendlyError.includes("UNAVAILABLE") || friendlyError.includes("503") || friendlyError.includes("demand") || friendlyError.includes("experiencing high demand")) {
          friendlyError = "The AI model is currently experiencing high demand. Please wait a few moments and click 'Analyze URL' again, or try pasting the manual text instead.";
        }
        
        // Return JSON error response with polished friendly message
        return res.status(502).json({ 
          error: friendlyError,
          code: "AI_ERROR"
        });
      }

    } catch (error: any) {
      console.error("Summarize Endpoint - Unexpected Error:", error);
      
      // ✅ CRITICAL: Always set content type and return JSON
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      
      return res.status(500).json({ 
        error: error.message || "Failed to summarize terms",
        code: "SERVER_ERROR",
        timestamp: new Date().toISOString()
      });
    }
  });

  // ==========================================
  // PADDLE SUBSCRIPTION SYNC HELPER (REUSABLE)
  // ==========================================
  async function syncUserProfileWithPaddle(userId: string, userEmail: string): Promise<{
    success: boolean;
    synced: boolean;
    plan?: string;
    billing_cycle?: string;
    paddle_subscription_id?: string;
    message?: string;
  }> {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) return { success: true, synced: false, message: "Demo mode: Sync bypass" };

      const { data: profile, error: fetchErr } = await admin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchErr || !profile) {
        return { success: false, synced: false, message: "Profile not found" };
      }

      const customerId = profile.paddle_customer_id;
      const subscriptionId = profile.paddle_subscription_id;
      
      const apiKey = process.env.PADDLE_API_KEY;
      const isPaddleConfigured = apiKey && apiKey !== "your-paddle-api-key" && !apiKey.includes("your-");

      if (!isPaddleConfigured) {
        return { success: true, synced: false, message: "Paddle API not configured" };
      }

      let activeSub: any = null;
      let paddleEnv = process.env.VITE_PADDLE_ENVIRONMENT || "sandbox";
      if (apiKey.startsWith("paddlesandbox_")) {
        paddleEnv = "sandbox";
      } else if (apiKey.startsWith("paddle_")) {
        paddleEnv = "production";
      }

      const baseUrl = paddleEnv === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

      // 1. Try customer_id lookup if we have it
      if (customerId) {
        const listUrl = `${baseUrl}/subscriptions?customer_id=${customerId}&status=active,trialing`;
        console.log(`[Sync Helper] Fetching by customer_id: ${listUrl}`);
        try {
          const subRes = await fetch(listUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Paddle-Version": "1"
            }
          });

          if (subRes.ok) {
            const subData: any = await subRes.json();
            const activeSubs = subData?.data || [];
            if (activeSubs.length > 0) {
              activeSub = activeSubs[0];
            }
          }
        } catch (e) {
          console.error("[Sync Helper] Error during customer_id fetch:", e);
        }
      }

      // 2. Try subscription_id lookup if no active sub found by customer_id
      if (!activeSub && subscriptionId && subscriptionId !== "sub_sandbox_completed" && !subscriptionId.startsWith("sub_sim_")) {
        const subUrl = `${baseUrl}/subscriptions/${subscriptionId}`;
        console.log(`[Sync Helper] Fetching by subscription_id: ${subUrl}`);
        try {
          const subRes = await fetch(subUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Paddle-Version": "1"
            }
          });

          if (subRes.ok) {
            const subData: any = await subRes.json();
            if (subData?.data && (subData.data.status === "active" || subData.data.status === "trialing")) {
              activeSub = subData.data;
            }
          }
        } catch (e) {
          console.error("[Sync Helper] Error during subscription_id fetch:", e);
        }
      }

      // 3. Fallback: Search by email
      if (!activeSub && userEmail) {
        console.log(`[Sync Helper] Attempting direct customer lookup by email: ${userEmail}`);
        const custSearchUrl = `${baseUrl}/customers?email=${encodeURIComponent(userEmail)}`;
        try {
          const custSearchRes = await fetch(custSearchUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Paddle-Version": "1"
            }
          });
          if (custSearchRes.ok) {
            const custSearchData: any = await custSearchRes.json();
            const customers = custSearchData?.data || [];
            if (customers.length > 0) {
              const matchedCustId = customers[0].id;
              console.log(`[Sync Helper] Found matched customer ID: ${matchedCustId} by email direct search`);
              const subUrl = `${baseUrl}/subscriptions?customer_id=${matchedCustId}&status=active,trialing`;
              const subRes = await fetch(subUrl, {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Paddle-Version": "1"
                }
              });
              if (subRes.ok) {
                const subData: any = await subRes.json();
                const activeSubs = subData?.data || [];
                if (activeSubs.length > 0) {
                  activeSub = activeSubs[0];
                  console.log(`[Sync Helper] Found active subscription: ${activeSub.id} via direct customer email lookup!`);
                }
              }
            }
          }
        } catch (e) {
          console.error("[Sync Helper] Error during direct customer email lookup:", e);
        }
      }

      // 4. Ultimate Fallback: Scan all active subscriptions
      if (!activeSub && userEmail) {
        const listUrl = `${baseUrl}/subscriptions?status=active,trialing`;
        console.log(`[Sync Helper] Falling back to scanning all active subs and searching for email: ${userEmail}`);
        try {
          const subRes = await fetch(listUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "Paddle-Version": "1"
            }
          });

          if (subRes.ok) {
            const subData: any = await subRes.json();
            const activeSubs = subData?.data || [];
            for (const sub of activeSubs) {
              const subCustId = sub.customer_id;
              if (subCustId) {
                const custRes = await fetch(`${baseUrl}/customers/${subCustId}`, {
                  method: "GET",
                  headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Paddle-Version": "1"
                  }
                });
                if (custRes.ok) {
                  const custData: any = await custRes.json();
                  if (custData?.data?.email?.toLowerCase() === userEmail.toLowerCase()) {
                    activeSub = sub;
                    break;
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("[Sync Helper] Error during scanning all active subs:", e);
        }
      }

      if (activeSub) {
        // 1. Check custom_data from activeSub
        const customCycle = activeSub.custom_data?.billingCycle || activeSub.custom_data?.billing_cycle;

        // 2. Check price_id directly against configured environment variables
        const items = activeSub.items || [];
        const itemPriceId = items[0]?.price_id || items[0]?.price?.id || "";
        const yearlyId = process.env.VITE_PADDLE_PRICE_YEARLY;
        const monthlyId = process.env.VITE_PADDLE_PRICE_MONTHLY;

        let detectedByPriceId: string | null = null;
        if (itemPriceId) {
          if (yearlyId && itemPriceId === yearlyId) {
            detectedByPriceId = "yearly";
          } else if (monthlyId && itemPriceId === monthlyId) {
            detectedByPriceId = "monthly";
          }
        }

        // 3. Check price description, name, or ID for keywords
        let detectedByKeywords: string | null = null;
        if (items.length > 0) {
          for (const item of items) {
            const priceObj = item?.price || {};
            const checkStr = String(priceObj.description || priceObj.name || priceObj.id || item.price_id || "").toLowerCase();
            if (checkStr.includes("year") || checkStr.includes("annual") || checkStr.includes("yr") || checkStr.includes("108")) {
              detectedByKeywords = "yearly";
              break;
            } else if (checkStr.includes("month") || checkStr.includes("monthly")) {
              detectedByKeywords = "monthly";
            }
          }
        }

        // 4. Raw billing cycle object or string
        const rawCycleObj = activeSub.billing_cycle || items[0]?.price?.billing_cycle || items[0]?.price?.billingCycle;

        let detectedBillingCycle = "monthly";
        if (customCycle) {
          detectedBillingCycle = parseBillingCycle(customCycle);
        } else if (detectedByPriceId) {
          detectedBillingCycle = detectedByPriceId;
        } else if (detectedByKeywords) {
          detectedBillingCycle = detectedByKeywords;
        } else if (rawCycleObj) {
          detectedBillingCycle = parseBillingCycle(rawCycleObj);
        } else if (profile?.billing_cycle) {
          detectedBillingCycle = parseBillingCycle(profile.billing_cycle);
        }

        const updateFields: any = {
          plan: `pro-${detectedBillingCycle}`,
          billing_cycle: detectedBillingCycle,
          paddle_subscription_id: activeSub.id,
          paddle_customer_id: activeSub.customer_id || customerId,
          cancel_at_period_end: activeSub.scheduled_change?.action === "cancel" || activeSub.scheduled_change?.effective_at ? true : false
        };

        const { error: updateErr } = await admin
          .from("profiles")
          .update(updateFields)
          .eq("id", userId);

        if (updateErr) {
          if (updateErr.code === "42703" || updateErr.code === "PGRST204") {
            await admin
              .from("profiles")
              .update({
                plan: `pro-${detectedBillingCycle}`,
                billing_cycle: detectedBillingCycle,
                paddle_subscription_id: activeSub.id
              })
              .eq("id", userId);
          } else {
            throw updateErr;
          }
        }

        console.log(`[Sync Helper Success] Successfully synchronized user ${userId} to pro-${detectedBillingCycle}`);
        return { 
          success: true, 
          synced: true, 
          plan: "pro", 
          billing_cycle: detectedBillingCycle,
          paddle_subscription_id: activeSub.id
        };
      }

      return { success: true, synced: false, message: "No active subscription found on Paddle." };
    } catch (err: any) {
      console.error("[Sync Helper Error] Error in syncUserProfileWithPaddle:", err);
      return { success: false, synced: false, message: err.message };
    }
  }

  // Upgrade Mock & Real Storage
  app.post("/api/profile/upgrade", authenticateUser, async (req: any, res) => {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) return res.json({ success: true, message: "Demo mode: Upgrade not persistent" });

      try {
        const { planType = "monthly", subscriptionId, customerId } = req.body;
        console.log(`[Upgrade] Upgrading user ${req.user.id} to ${planType} plan. Subscription ID: ${subscriptionId || "None"}, Customer ID: ${customerId || "None"}`);

        let resolvedSubscriptionId = subscriptionId;
        const apiKey = process.env.PADDLE_API_KEY;
        const isPaddleConfigured = apiKey && apiKey !== "your-paddle-api-key" && !apiKey.includes("your-");

        if (isPaddleConfigured && customerId && (subscriptionId === "sub_sandbox_completed" || !subscriptionId || subscriptionId.startsWith("sub_sim_"))) {
          console.log(`[Paddle Sync] Looking up active subscription for customer: ${customerId}`);
          let paddleEnv = process.env.VITE_PADDLE_ENVIRONMENT || "sandbox";
          if (apiKey.startsWith("paddlesandbox_")) {
            paddleEnv = "sandbox";
          } else if (apiKey.startsWith("paddle_")) {
            paddleEnv = "production";
          }

          const baseUrl = paddleEnv === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
          const listUrl = `${baseUrl}/subscriptions?customer_id=${customerId}&status=active,trialing`;

          // Let's do up to 3 retries with 500ms sleep
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              console.log(`[Paddle Sync] Fetching subscriptions (Attempt ${attempt}/3): ${listUrl}`);
              const subRes = await fetch(listUrl, {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Paddle-Version": "1"
                }
              });

              if (subRes.ok) {
                const subData: any = await subRes.json();
                const activeSubs = subData?.data || [];
                if (activeSubs.length > 0) {
                  // Found an active subscription! Use its ID.
                  resolvedSubscriptionId = activeSubs[0].id;
                  console.log(`[Paddle Sync Success] Resolved subscription ID: ${resolvedSubscriptionId} for customer: ${customerId}`);
                  break;
                } else {
                  console.log(`[Paddle Sync] No active subscriptions found on attempt ${attempt}`);
                }
              } else {
                console.warn(`[Paddle Sync Warning] API responded with status ${subRes.status} on attempt ${attempt}`);
              }
            } catch (err) {
              console.error(`[Paddle Sync Attempt ${attempt} Error]`, err);
            }
            // Sleep for 500ms before retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Try to update with all possible columns
        const updateFields: any = { 
          plan: `pro-${planType}`,
          billing_cycle: planType,
          analyses_count: 0
        };

        if (resolvedSubscriptionId) {
          updateFields.paddle_subscription_id = resolvedSubscriptionId;
        }
        if (customerId) {
          updateFields.paddle_customer_id = customerId;
        }

        const { error } = await admin
          .from("profiles")
          .update(updateFields)
          .eq("id", req.user.id);

        if (error) {
          // Handle common PG errors gracefully
          if (error.code === "42P01") {
            console.warn("Upgrade failed: 'profiles' table missing. Using session-only mode.");
            return res.json({ success: true, message: "Demo mode: Upgrade not persistent (Table missing)" });
          }
          
          // If columns like paddle_subscription_id are missing, fallback to standard plan string persist
          if (error.code === "42703" || error.code === "PGRST204" || error.code === "PGRST200") {
            const retryFields: any = { 
              plan: `pro-${planType}`,
              billing_cycle: planType,
              analyses_count: 0 
            };
            const { error: retryError } = await admin
              .from("profiles")
              .update(retryFields)
              .eq("id", req.user.id);
            if (retryError) {
               if (retryError.code === "42P01") return res.json({ success: true });
               throw retryError;
            }
          } else {
            throw error;
          }
        }

        // Proactively and automatically trigger real-time synchronization with Paddle registry on the server side
        if (isPaddleConfigured) {
          console.log(`[Paddle Sync] Upgrade complete. Auto-synchronising profile with Paddle registry...`);
          await syncUserProfileWithPaddle(req.user.id, req.user.email).catch(err => {
            console.error("[Paddle Sync Error during upgrade]:", err);
          });
        }

        res.json({ success: true, paddle_subscription_id: resolvedSubscriptionId });
      } catch (error: any) {
        const errorCode = error?.code || error?.message;
        console.error(`Upgrade Error [${errorCode}]:`, typeof error === 'object' ? error.message : error);
        return res.status(500).json({ error: "Failed to upgrade" });
      }
    } catch (err: any) {
      console.error("Unexpected error in /api/profile/upgrade:", err);
      return res.status(500).json({ 
        error: "Failed to upgrade",
        code: "UPGRADE_ERROR"
      });
    }
  });

  // Sync Profile with Paddle API - Real-time self-healing & reconciliation
  app.post("/api/profile/sync", authenticateUser, async (req: any, res) => {
    try {
      const syncResult = await syncUserProfileWithPaddle(req.user.id, req.user.email);
      if (syncResult.success) {
        return res.json(syncResult);
      } else {
        return res.status(404).json({ error: syncResult.message || "Failed to sync" });
      }
    } catch (err: any) {
      console.error("Error in /api/profile/sync:", err);
      return res.status(500).json({ error: "Failed to synchronise subscription" });
    }
  });

  // Cancel Subscription - Full Paddle API Connection & DB Resiliency
  app.post("/api/profile/cancel", authenticateUser, async (req: any, res) => {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) return res.json({ success: true, message: "Demo mode: Cancellation recorded" });

      const { force = false } = req.body || {};
      const validEffectiveFrom = "next_billing_period";

      try {
        // 1. Fetch user's active plan details to retrieve paddle_subscription_id and paddle_customer_id
        let paddleSubscriptionId: string | null = null;
        let customerId: string | null = null;
        let existingProfile: any = null;
        try {
          const { data: profile } = await admin
            .from("profiles")
            .select("*")
            .eq("id", req.user.id)
            .single();
          if (profile) {
            existingProfile = profile;
            paddleSubscriptionId = profile.paddle_subscription_id || null;
            customerId = profile.paddle_customer_id || null;
          }
        } catch (fetchErr) {
          console.warn("Could not fetch active profile for cancel check, proceeding with fallback...", fetchErr);
        }

        // 2. Contact Paddle API if subscription ID is present and API secret key is configured
        const apiKey = process.env.PADDLE_API_KEY;
        const isPaddleConfigured = apiKey && apiKey !== "your-paddle-api-key" && !apiKey.includes("your-");

        // If subscriptionId is mock or missing, but we have a real customerId, sync it now!
        if (isPaddleConfigured && customerId && (!paddleSubscriptionId || paddleSubscriptionId === "sub_sandbox_completed" || paddleSubscriptionId.startsWith("sub_sim_"))) {
          console.log(`[Paddle Cancel Sync] Stored subscription ID is invalid/missing. Syncing active subscription for customer: ${customerId}`);
          let paddleEnv = process.env.VITE_PADDLE_ENVIRONMENT || "sandbox";
          if (apiKey.startsWith("paddlesandbox_")) {
            paddleEnv = "sandbox";
          } else if (apiKey.startsWith("paddle_")) {
            paddleEnv = "production";
          }

          const baseUrl = paddleEnv === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
          const listUrl = `${baseUrl}/subscriptions?customer_id=${customerId}&status=active,trialing`;

          try {
            const subRes = await fetch(listUrl, {
              method: "GET",
              headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Paddle-Version": "1"
              }
            });

            if (subRes.ok) {
              const subData: any = await subRes.json();
              const activeSubs = subData?.data || [];
              if (activeSubs.length > 0) {
                paddleSubscriptionId = activeSubs[0].id;
                console.log(`[Paddle Cancel Sync Success] Resolved subscription ID: ${paddleSubscriptionId}`);
                // Update local DB profile with the real subscription ID so we don't lose it again
                await admin
                  .from("profiles")
                  .update({ paddle_subscription_id: paddleSubscriptionId })
                  .eq("id", req.user.id);
              }
            }
          } catch (syncErr) {
            console.error("[Paddle Cancel Sync Error]", syncErr);
          }
        }

        if (isPaddleConfigured) {
          if (!paddleSubscriptionId || paddleSubscriptionId === "sub_sandbox_completed" || paddleSubscriptionId.startsWith("sub_sim_")) {
            if (!force) {
              console.error("[Paddle Cancel Error] No active subscription ID found in database for user profile.");
              return res.status(400).json({
                error: "No active subscription ID was found associated with your profile. Please refresh the page or contact support if the issue persists.",
                code: "PADDLE_SUBSCRIPTION_NOT_FOUND",
                canForce: true
              });
            } else {
              console.warn("[Paddle Bypassed] No subscription ID, but proceeding with database clean up because force is requested.");
            }
          }
        }

        if (isPaddleConfigured && paddleSubscriptionId && paddleSubscriptionId !== "sub_sandbox_completed" && !paddleSubscriptionId.startsWith("sub_sim_")) {
          console.log(`[Paddle API] Dynamic cancellation initiated for subscription: ${paddleSubscriptionId} with effective_from: ${validEffectiveFrom}`);
          
          if (apiKey.startsWith("test_") || apiKey.startsWith("live_")) {
            const clientKeyMsg = `Paddle cancellation failed because you are using a public Client Token (starting with '${apiKey.substring(0, 5)}...') instead of a secret API key. Secret keys must start with 'paddlesandbox_' or 'paddle_'. Please update PADDLE_API_KEY in your settings.`;
            console.error(`[Paddle Config Error] ${clientKeyMsg}`);
            
            if (!force) {
              return res.status(403).json({
                error: clientKeyMsg,
                code: "PADDLE_CLIENT_TOKEN_REJECTED",
                canForce: true
              });
            }
          } else {
            try {
              // Automatically detect sandbox vs production based on the Paddle API Key prefix
              let paddleEnv = process.env.VITE_PADDLE_ENVIRONMENT || "sandbox";
              if (apiKey.startsWith("paddlesandbox_")) {
                console.log("[Paddle Auto-detect] Key prefix is 'paddlesandbox_'. Routing request to Sandbox API.");
                paddleEnv = "sandbox";
              } else if (apiKey.startsWith("paddle_")) {
                console.log("[Paddle Auto-detect] Key prefix is 'paddle_'. Routing request to Production API.");
                paddleEnv = "production";
              }

              const baseUrl = paddleEnv === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
              const cancelUrl = `${baseUrl}/subscriptions/${paddleSubscriptionId}/cancel`;

              console.log(`[Paddle API Request] POST to: ${cancelUrl} using environment: ${paddleEnv} with body effective_from: ${validEffectiveFrom}`);
              const response = await fetch(cancelUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                  "Paddle-Version": "1"
                },
                body: JSON.stringify({
                  effective_from: validEffectiveFrom
                })
              });

              if (!response.ok) {
                const errBody = await response.text();
                console.error(`[Paddle API Error] Http: ${response.status} | Body: ${errBody}`);

                let errorDetails = `Paddle status ${response.status}: ${response.statusText || "Error response"}`;
                let errCode = "PADDLE_API_ERROR";
                try {
                  const parsed = JSON.parse(errBody);
                  if (parsed?.error?.detail) {
                    errorDetails = parsed.error.detail;
                  }
                  if (parsed?.error?.code) {
                    errCode = `PADDLE_${parsed.error.code.toUpperCase()}`;
                  }
                } catch (_) {}

                if (response.status === 404) {
                  console.warn("[Paddle API] Subscription not found on Paddle.");
                  if (!force) {
                    return res.status(404).json({
                      error: "Subscription was not found on Paddle. It may have already been cancelled or is in a different environment. If you want to cancel your local subscription anyway, check the Force option.",
                      code: "PADDLE_SUBSCRIPTION_NOT_FOUND",
                      canForce: true
                    });
                  }
                } else if (!force) {
                  let friendlyMsg = `Paddle cancellation failed: ${errorDetails}.`;
                  if (response.status === 403) {
                    friendlyMsg = `Paddle cancellation was rejected (403 Forbidden). Please check that your PADDLE_API_KEY has 'Subscriptions' Write permission scopes enabled in your Paddle Dashboard, and matches the target sandbox/production environment. Header 'Paddle-Version: 1' was sent.`;
                  } else if (response.status === 401) {
                    friendlyMsg = `Paddle authentication failed (401 Unauthorized). Please check that your PADDLE_API_KEY is configured correctly.`;
                  }

                  return res.status(response.status >= 400 && response.status < 600 ? response.status : 400).json({
                    error: friendlyMsg,
                    code: errCode,
                    canForce: true
                  });
                } else {
                  console.warn(`[Paddle Bypassed] Paddle error ${response.status} ignored because force downgrade was requested.`);
                }
              } else {
                console.log("[Paddle API Success] Paddle subscription canceled successfully.");
              }
            } catch (paddleReqErr: any) {
              console.error("[Paddle Call Error] Connecting to Paddle server failed:", paddleReqErr.message);
              if (!force) {
                return res.status(502).json({
                  error: `Connecting to Paddle server failed: ${paddleReqErr.message}.` || "Connecting to Paddle server failed.",
                  code: "PADDLE_CONNECT_ERROR",
                  canForce: true
                });
              } else {
                console.warn("[Paddle Bypassed] Network error ignored because force downgrade was requested.");
              }
            }
          }
        } else {
          console.log(`[Cancel Simulation] No live subscription or Paddle key not present (Paddle ID: ${paddleSubscriptionId || 'None'}). Proceeding with database cleanup.`);
        }

        // 3. Update database profiles
        const planToSet = validEffectiveFrom === "next_billing_period" 
          ? (existingProfile?.plan || "pro-monthly") 
          : "free";
        const cancelAtPeriodEnd = validEffectiveFrom === "next_billing_period" ? true : null;

        const updateData: any = {
          plan: planToSet,
        };

        if (cancelAtPeriodEnd) {
          updateData.cancel_at_period_end = true;
        } else {
          updateData.paddle_subscription_id = null;
          updateData.cancel_at_period_end = null;
        }

        const { error } = await admin
          .from("profiles")
          .update(updateData)
          .eq("id", req.user.id);

        if (error) {
          if (error.code === "42P01") {
            return res.json({ success: true, message: "Demo mode: Cancellation recorded (Table missing)" });
          }

          if (error.code === "42703" || error.code === "PGRST204") {
            const { error: retryError } = await admin
              .from("profiles")
              .update({ plan: planToSet })
              .eq("id", req.user.id);
            if (retryError) {
              if (retryError.code === "42P01") return res.json({ success: true });
              throw retryError;
            }
          } else {
            throw error;
          }
        }
        res.json({ success: true, effective_from: validEffectiveFrom });
      } catch (error: any) {
        const errorCode = error?.code || error?.message;
        console.error(`Cancel Error [${errorCode}]:`, typeof error === 'object' ? error.message : error);
        return res.status(500).json({ error: "Failed to cancel subscription" });
      }
    } catch (err: any) {
      console.error("Unexpected error in /api/profile/cancel:", err);
      return res.status(500).json({ 
        error: "Failed to cancel subscription",
        code: "CANCEL_ERROR"
      });
    }
  });

  // Generate Paddle Customer Portal Session link
  app.post("/api/profile/portal-session", authenticateUser, async (req: any, res) => {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) {
        return res.status(400).json({ error: "Supabase admin not configured" });
      }

      // Fetch user profile to get customer ID and subscription ID
      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("*")
        .eq("id", req.user.id)
        .single();

      if (profileErr || !profile) {
        return res.status(404).json({ error: "User profile not found" });
      }

      const customerId = profile.paddle_customer_id;
      const subscriptionId = profile.paddle_subscription_id;

      if (!customerId) {
        return res.status(400).json({
          error: "No associated Paddle Customer ID found. Please make sure you have subscribed first.",
          code: "NO_CUSTOMER_ID"
        });
      }

      if (!subscriptionId) {
        return res.status(400).json({
          error: "No active Paddle Subscription ID found.",
          code: "NO_SUBSCRIPTION_ID"
        });
      }

      const apiKey = process.env.PADDLE_API_KEY;
      if (!apiKey || apiKey === "your-paddle-api-key" || apiKey.includes("your-")) {
        return res.status(400).json({ error: "Paddle API Key not configured on the server." });
      }

      // Automatically detect sandbox vs production based on the Paddle API Key prefix
      let paddleEnv = process.env.VITE_PADDLE_ENVIRONMENT || "sandbox";
      if (apiKey.startsWith("paddlesandbox_")) {
        paddleEnv = "sandbox";
      } else if (apiKey.startsWith("paddle_")) {
        paddleEnv = "production";
      }

      const baseUrl = paddleEnv === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
      const portalUrl = `${baseUrl}/customers/${customerId}/portal-sessions`;

      console.log(`[Paddle API Portal Session] Creating portal session at: ${portalUrl}`);
      
      const response = await fetch(portalUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Paddle-Version": "1"
        },
        body: JSON.stringify({
          subscription_ids: [subscriptionId]
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[Paddle API Portal Session Error] Http: ${response.status} | Body: ${errBody}`);
        return res.status(response.status).json({
          error: `Failed to create Paddle portal session: ${response.statusText}`,
          details: errBody
        });
      }

      const result = await response.json();
      console.log("[Paddle API Portal Session Success] Created portal session successfully.");

      // Check for subscription deep link or general URL
      const subscriptions = result?.data?.urls?.subscriptions || [];
      const cancelUrl = subscriptions[0]?.cancel || result?.data?.urls?.general?.overview;

      return res.json({
        success: true,
        portal_url: cancelUrl || result?.data?.urls?.general?.overview,
        data: result?.data
      });

    } catch (err: any) {
      console.error("Unexpected error in /api/profile/portal-session:", err);
      return res.status(500).json({
        error: "Failed to generate customer portal session",
        code: "PORTAL_SESSION_ERROR"
      });
    }
  });

  // History Endpoint
  app.get("/api/scans", authenticateUser, async (req: any, res) => {
    try {
      const admin = getSupabaseAdmin();
      if (!admin) return res.json([]);

      try {
        const { data, error } = await admin
          .from("scans")
          .select("*")
          .eq("user_id", req.user.id)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) {
          if (error.code === "42P01") return res.json([]);
          throw error;
        }
        res.json(data);
      } catch (error: any) {
        return res.status(500).json({ error: "Failed to fetch scans" });
      }
    } catch (err: any) {
      console.error("Unexpected error in /api/scans:", err);
      return res.status(500).json({ 
        error: "Failed to fetch scans",
        code: "SCANS_ERROR"
      });
    }
  });

  // Resilient Webhook helper to verify signature manually (Optional verification if secret not configured)
  const verifyPaddleWebhook = (rawBody: string, signatureHeader: string, secret: string): boolean => {
    if (!signatureHeader || !secret) return false;
    try {
      const parts = signatureHeader.split(";").reduce((acc: any, part) => {
        const [key, val] = part.split("=");
        if (key && val) acc[key] = val;
        return acc;
      }, {});
      
      const ts = parts.ts;
      const h1 = parts.h1;
      
      if (!ts || !h1) return false;
      
      const signedPayload = `${ts}:${rawBody}`;
      const computedHash = crypto
        .createHmac("sha256", secret)
        .update(signedPayload)
        .digest("hex");
        
      return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(h1));
    } catch (e) {
      console.error("[Webhook Sig Verification Failed Exception]:", e);
      return false;
    }
  };

  // NOTE: This used to end with a `deepFindBillingCycle()` fallback that did
  // fuzzy substring matching ("month"/"year") across every key of the raw
  // Paddle payload, recursively, including unrelated fields like `name` or
  // `description`. That is what was causing the bug: when the earlier,
  // reliable checks below found nothing, that fallback would grab an
  // unrelated match elsewhere in the payload and confidently return
  // "monthly", silently overwriting a correct "yearly" value written moments
  // earlier by /api/profile/upgrade. It has been removed. Detection now
  // returns null on ambiguity instead of guessing — see the "4. Unknown"
  // branch below, and how finalBillingCycle is resolved where this is called.
  // Webhook billing cycle detection has been completely disabled to prevent overwriting
  // the accurate billing cycle set by the direct manual API upgrade route.

  // Paddle Webhook API handler (Supporting both /api/paddle-webhook and /api/checkout fallback)
  const paddleWebhookHandler = async (req: any, res: any) => {
    try {
      console.log(`[Paddle Webhook Received] Headers: ${JSON.stringify(req.headers)}`);
      
      const apiKey = process.env.PADDLE_API_KEY;
      const sigHeader = req.headers["paddle-signature"] || "";
      const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
      
      // Verification logic with optional bypass if secret is not set
      if (webhookSecret && webhookSecret !== "your-webhook-secret") {
        const rawBodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        const isValid = verifyPaddleWebhook(rawBodyStr, sigHeader, webhookSecret);
        if (!isValid) {
          console.error("[Paddle Webhook Error] Invalid webhook signature detected.");
          return res.status(401).json({ error: "Invalid Paddle webhook signature" });
        }
        console.log("[Paddle Webhook] Signature verified successfully.");
      } else {
        console.log("[Paddle Webhook Bypass] No webhook secret (PADDLE_WEBHOOK_SECRET) is set. Safely skipping signature check.");
      }

      // Parse payload
      const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      console.log(`[Paddle Webhook RAW Payload] ${JSON.stringify(payload)}`);
      const eventType = payload?.event_type;
      const eventData = payload?.data;

      if (!eventType || !eventData) {
        console.warn("[Paddle Webhook Warning] Empty or unhandled event payload received.");
        return res.json({ success: true, message: "Unhandled payload format" });
      }

      console.log(`[Paddle Webhook Event] Processing event: '${eventType}' for ID: ${eventData.id}`);

      // Extract details
      let customerId = eventData.customer_id || eventData.customer?.id;
      let subscriptionId = eventData.subscription_id || (eventType.startsWith("subscription.") ? eventData.id : null);
      let planStatus = eventData.status; // active, trialing, paused, canceled
      
      // Determine timestamps
      let startsAt = eventData.current_billing_period?.starts_at || eventData.started_at;
      let endsAt = eventData.current_billing_period?.ends_at || eventData.next_billed_at;
      const customerEmail = eventData.customer?.email || eventData.customer_email || "";

      // Search for associated userId in custom data (Check both spellings and nested levels!)
      let customData = eventData.custom_data || 
                       eventData.subscription?.custom_data || 
                       eventData.transaction?.custom_data || 
                       {};
      let targetUserId = customData.userId || customData.user_id;

      const admin = getSupabaseAdmin();
      if (!admin) {
        console.warn("[Paddle Webhook Bypass] Supabase admin not configured. Skipping persistent database update.");
        return res.json({ success: true, message: "Demo mode webhook recorded" });
      }

      // 1. Try to find user by paddle_subscription_id if targetUserId is missing
      if (!targetUserId && subscriptionId) {
        console.log(`[Paddle Webhook Fallback] No userId in customData, searching profile table by paddle_subscription_id: ${subscriptionId}`);
        try {
          const { data: profiles, error: findErr } = await admin
            .from("profiles")
            .select("id")
            .eq("paddle_subscription_id", subscriptionId);
          if (!findErr && profiles && profiles.length > 0) {
            targetUserId = profiles[0].id;
            console.log(`[Paddle Webhook Fallback Success] Found local user ID by subscription ID: ${targetUserId}`);
          }
        } catch (findEx) {
          console.error("[Paddle Webhook Fallback] Error finding profile by subscription ID:", findEx);
        }
      }

      // 2. Try to find user by paddle_customer_id if targetUserId is still missing
      if (!targetUserId && customerId) {
        console.log(`[Paddle Webhook Fallback] No userId in customData, searching profile table by paddle_customer_id: ${customerId}`);
        try {
          const { data: profiles, error: findErr } = await admin
            .from("profiles")
            .select("id")
            .eq("paddle_customer_id", customerId);
          if (!findErr && profiles && profiles.length > 0) {
            targetUserId = profiles[0].id;
            console.log(`[Paddle Webhook Fallback Success] Found local user ID by customer ID: ${targetUserId}`);
          }
        } catch (findEx) {
          console.error("[Paddle Webhook Fallback] Error finding profile by customer ID:", findEx);
        }
      }

      // 3. Email fallback if targetUserId is missing and we couldn't resolve by IDs
      if (!targetUserId) {
        if (customerEmail) {
          console.log(`[Paddle Webhook Fallback] No userId in customData, searching profile table by customer email: ${customerEmail}`);
          try {
            const { data: profiles, error: findErr } = await admin
              .from("profiles")
              .select("id")
              .eq("email", customerEmail);
            
            if (!findErr && profiles && profiles.length > 0) {
              targetUserId = profiles[0].id;
              console.log(`[Paddle Webhook Fallback Success] Found local user ID: ${targetUserId}`);
            } else {
              // Try querying auth users directly
              console.log(`[Paddle Webhook Fallback Retry] Searching auth users...`);
              const { data: { users }, error: authErr } = await admin.auth.admin.listUsers();
              if (!authErr && users) {
                const matchedUser = users.find((u: any) => u.email?.toLowerCase() === customerEmail.toLowerCase());
                if (matchedUser) {
                  targetUserId = matchedUser.id;
                  console.log(`[Paddle Webhook Fallback Retry Success] Found user ID in auth: ${targetUserId}`);
                }
              }
            }
          } catch (findEx) {
            console.error("[Paddle Webhook Fallback Error]", findEx);
          }
        }
      }

      if (!targetUserId) {
        console.warn(`[Paddle Webhook Warning] Could not find associated user ID for customer ID: ${customerId} / subscription ID: ${subscriptionId}. Skipping profile upgrade/downgrade.`);
        return res.json({ success: true, message: "No matching user found" });
      }

      // Perform DB updates
      if (
        eventType === "subscription.created" || 
        eventType === "subscription.updated" || 
        eventType === "subscription.update" ||
        eventType === "subscription.canceled" ||
        eventType === "subscription.paused" ||
        eventType === "subscription.resumed" ||
        eventType === "transaction.completed"
      ) {
        console.log(`[Paddle Webhook DB Update] Processing event '${eventType}' for user ${targetUserId}. Subscription: ${subscriptionId}, Status: ${planStatus}`);

        const isCanceled = eventType === "subscription.canceled" || planStatus === "canceled" || planStatus === "paused";
        const hasScheduledCancellation = eventData.scheduled_change?.action === "cancel" || eventData.scheduled_change?.effective_at;

        // Fetch existing profile to see if we have an existing billing cycle in database (for ALL events)
        let existingBillingCycle = null;
        let existingPlan = null;
        try {
          const { data: p, error: selectErr } = await admin.from("profiles").select("*").eq("id", targetUserId).single();
          if (selectErr) {
            console.error("[Paddle Webhook Debug] Error querying existing profile from DB:", selectErr);
          }
          if (p) {
            existingPlan = p.plan || null;
            if (p.billing_cycle) {
              existingBillingCycle = parseBillingCycle(p.billing_cycle);
            } else if (p.plan && (p.plan.includes("_") || p.plan.includes("-"))) {
              const separator = p.plan.includes("_") ? "_" : "-";
              const parts = p.plan.split(separator);
              if (parts[1]) {
                existingBillingCycle = parseBillingCycle(parts[1]);
              }
            }
            console.log(`[Paddle Webhook Debug] Found existing profile in DB: plan='${existingPlan}', billing_cycle='${existingBillingCycle}'`);
          }
        } catch (dbQueryErr) {
          console.error("[Paddle Webhook Debug] Exception querying existing profile:", dbQueryErr);
        }

        try {
          // Detect the correct billing cycle from the webhook payload itself or by fetching from Paddle
          let detectedBillingCycle = null;

          // 1. Fetch directly from Paddle API (100% accurate)
          if (apiKey && subscriptionId && subscriptionId !== "sub_sandbox_completed" && !subscriptionId.startsWith("sub_sim_")) {
            try {
              let paddleEnv = process.env.VITE_PADDLE_ENVIRONMENT || "sandbox";
              if (apiKey.startsWith("paddlesandbox_")) {
                paddleEnv = "sandbox";
              } else if (apiKey.startsWith("paddle_")) {
                paddleEnv = "production";
              }
              const baseUrl = paddleEnv === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
              const subUrl = `${baseUrl}/subscriptions/${subscriptionId}`;
              console.log(`[Paddle Webhook Debug] Fetching full subscription to verify billing cycle: ${subUrl}`);
              const subRes = await fetch(subUrl, {
                method: "GET",
                headers: {
                  "Authorization": `Bearer ${apiKey}`,
                  "Paddle-Version": "1"
                }
              });
              if (subRes.ok) {
                const subData: any = await subRes.json();
                const realSub = subData?.data;
                if (realSub) {
                  const cycleObj = realSub.billing_cycle || realSub.items?.[0]?.price?.billing_cycle;
                  if (cycleObj) {
                    detectedBillingCycle = parseBillingCycle(cycleObj);
                    console.log(`[Paddle Webhook Success] Verified subscription billing cycle directly from Paddle: ${detectedBillingCycle}`);
                  }
                }
              }
            } catch (err) {
              console.error("[Paddle Webhook Error] Failed to fetch subscription for billing cycle check:", err);
            }
          }

          const customCycle = customData?.billingCycle || customData?.billing_cycle || 
                              payload?.custom_data?.billingCycle || payload?.custom_data?.billing_cycle ||
                              eventData?.custom_data?.billingCycle || eventData?.custom_data?.billing_cycle ||
                              eventData?.subscription?.custom_data?.billingCycle || eventData?.subscription?.custom_data?.billing_cycle ||
                              eventData?.transaction?.custom_data?.billingCycle || eventData?.transaction?.custom_data?.billing_cycle;

          const payloadCycleObj = eventData?.billing_cycle || 
                                 eventData?.subscription?.billing_cycle || 
                                 eventData?.transaction?.billing_cycle;
          
          let priceCycleObj = null;
          const items = eventData?.items || eventData?.subscription?.items || eventData?.transaction?.items || [];
          if (items.length > 0) {
            priceCycleObj = items[0]?.price?.billing_cycle || items[0]?.price?.billingCycle;
          }

          // Try checking price ID directly against configured price IDs
          let detectedByPriceId = null;
          if (items.length > 0) {
            const priceId = items[0]?.price_id || items[0]?.price?.id || "";
            const yearlyId = process.env.VITE_PADDLE_PRICE_YEARLY || "pri_yearly_default_id";
            const monthlyId = process.env.VITE_PADDLE_PRICE_MONTHLY || "pri_monthly_default_id";
            
            if (priceId && yearlyId && priceId === yearlyId) {
              detectedByPriceId = "yearly";
            } else if (priceId && monthlyId && priceId === monthlyId) {
              detectedByPriceId = "monthly";
            }
          }

          // Try looking at price description, names, or price IDs for keywords
          let detectedByKeywords = null;
          if (items.length > 0) {
            for (const item of items) {
              const priceObj = item?.price || {};
              const checkStr = String(priceObj.description || priceObj.name || priceObj.id || item.price_id || "").toLowerCase();
              if (checkStr.includes("year") || checkStr.includes("annual") || checkStr.includes("yr") || checkStr.includes("108")) {
                detectedByKeywords = "yearly";
                break;
              } else if (checkStr.includes("month") || checkStr.includes("monthly")) {
                detectedByKeywords = "monthly";
              }
            }
          }

          // Heuristic based on checkout/transaction totals
          let detectedByAmount = null;
          const totals = eventData?.details?.totals || eventData?.totals || eventData?.transaction?.details?.totals || {};
          const subtotal = parseFloat(totals.subtotal || totals.subTotal || "0");
          const grandTotal = parseFloat(totals.grand_total || totals.grandTotal || totals.total || "0");
          
          if (subtotal >= 50 || grandTotal >= 50 || subtotal >= 5000 || grandTotal >= 5000) {
            detectedByAmount = "yearly";
          } else if ((subtotal > 0 && subtotal < 25) || (grandTotal > 0 && grandTotal < 25) || (subtotal > 0 && subtotal < 2500) || (grandTotal > 0 && grandTotal < 2500)) {
            detectedByAmount = "monthly";
          }

          if (!detectedBillingCycle) {
            // 1. Prioritise custom checkout metadata (100% accurate for checkouts created by our app)
            if (customCycle) {
              detectedBillingCycle = parseBillingCycle(customCycle);
            }
            // 2. Next, check matched price IDs
            else if (detectedByPriceId) {
              detectedBillingCycle = detectedByPriceId;
            }
            // 3. Next, check price description keywords
            else if (detectedByKeywords) {
              detectedBillingCycle = detectedByKeywords;
            }
            // 4. Next, check transaction amount/totals heuristic
            else if (detectedByAmount) {
              detectedBillingCycle = detectedByAmount;
            }
            // 5. Next, fallback to general billing cycle payload objects from Paddle
            else if (payloadCycleObj) {
              detectedBillingCycle = parseBillingCycle(payloadCycleObj);
            } else if (priceCycleObj) {
              detectedBillingCycle = parseBillingCycle(priceCycleObj);
            }
            // 6. Next, use existing DB state
            else if (existingBillingCycle) {
              detectedBillingCycle = existingBillingCycle;
            } else if (existingPlan) {
              if (existingPlan.includes("year") || existingPlan.includes("annual")) {
                detectedBillingCycle = "yearly";
              } else {
                detectedBillingCycle = "monthly";
              }
            } else {
              detectedBillingCycle = "monthly"; // Ultimate fallback
            }
          }

          // Protect existing "yearly" billing cycle against accidental "monthly" overwrite if we ended up guessing or falling back
          if ((!detectedBillingCycle || detectedBillingCycle === "monthly") && existingBillingCycle === "yearly" && !isCanceled) {
            console.log(`[Paddle Webhook Debug] Preserving existing "yearly" billing cycle from DB instead of overwriting/falling back to "monthly"`);
            detectedBillingCycle = "yearly";
          }

          let synced = false;
          const isPaddleConfigured = apiKey && apiKey !== "your-paddle-api-key" && !apiKey.includes("your-");

          if (!isCanceled && isPaddleConfigured) {
            console.log(`[Paddle Webhook] Proactively auto-syncing profile ${targetUserId} with Paddle registry...`);
            try {
              const syncResult = await syncUserProfileWithPaddle(targetUserId, customerEmail);
              if (syncResult && syncResult.synced) {
                synced = true;
                console.log(`[Paddle Webhook] Direct registry sync succeeded! User ${targetUserId} updated to ${syncResult.billing_cycle}.`);
              }
            } catch (syncErr) {
              console.error("[Paddle Webhook] Direct registry sync failed, falling back to payload parsing:", syncErr);
            }
          }

          if (!synced) {
            console.log(`[Paddle Webhook Debug] Detected billing cycle: ${detectedBillingCycle}`);

            // Attempt update with all possible columns
            const updateFields: any = {
              plan: isCanceled ? "free" : `pro-${detectedBillingCycle}`,
              billing_cycle: isCanceled ? null : detectedBillingCycle,
              paddle_subscription_id: isCanceled ? null : subscriptionId,
              paddle_customer_id: customerId,
              cancel_at_period_end: isCanceled ? false : (hasScheduledCancellation ? true : false)
            };

            if (startsAt && !isCanceled) updateFields.subscription_start = startsAt;
            if (endsAt && !isCanceled) updateFields.subscription_end = endsAt;

            const { error } = await admin
              .from("profiles")
              .update(updateFields)
              .eq("id", targetUserId);

            if (error) {
              // Fallback for column errors (42703 / PGRST204)
              if (error.code === "42703" || error.code === "PGRST204") {
                console.log("[Webhook DB Fallback] Column mismatch, retrying with standard columns...");
                
                let fallbackPlan = "pro";
                if (isCanceled) {
                  fallbackPlan = "free";
                } else {
                  fallbackPlan = `pro-${detectedBillingCycle}`;
                }

                const fallbackFields: any = {
                  plan: fallbackPlan,
                  billing_cycle: isCanceled ? null : detectedBillingCycle,
                  paddle_subscription_id: isCanceled ? null : subscriptionId
                };
                await admin
                  .from("profiles")
                  .update(fallbackFields)
                  .eq("id", targetUserId);
              } else {
                throw error;
              }
            }
            console.log(`[Paddle Webhook DB Update Success] Profile updated successfully with billing cycle: ${detectedBillingCycle}`);
          }
        } catch (dbErr: any) {
          console.error("[Paddle Webhook DB Update Error]", dbErr);
        }
      }

      return res.json({ success: true, processed: true });

    } catch (err: any) {
      console.error("[Paddle Webhook Error Handler Exception]", err);
      return res.status(500).json({ error: "Internal Webhook Error", details: err.message });
    }
  };

  app.post("/api/paddle-webhook", paddleWebhookHandler);
  app.post("/api/checkout", paddleWebhookHandler);

  // ✅ Global Error Handler (Keep at the bottom of routes)
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Server Error:", err);
    
    // Set content type
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // Return JSON error
    res.status(res.statusCode === 200 ? 500 : res.statusCode).json({
      error: err.message || "An internal server error occurred",
      code: "INTERNAL_ERROR",
      timestamp: new Date().toISOString()
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Termsreader server running at http://localhost:${PORT}`);
  });
}

startServer();