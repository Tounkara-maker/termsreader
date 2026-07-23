const statusText = document.getElementById('status');
const spinner = document.getElementById('spinner');
const resultsDiv = document.getElementById('results');
const clearBtn = document.getElementById('clear-btn');
const scanBtn = document.getElementById('scan-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginBtn = document.getElementById('login-btn');
const loginContainer = document.getElementById('login-container');
const urlDisplay = document.getElementById('current-url');
const mainInterface = document.getElementById('main-interface');
const footerActions = document.getElementById('footer-actions');

// Manual Input Elements
const manualTextarea = document.getElementById('manual-text');
const submitManualBtn = document.getElementById('submit-manual');

// Tab switcher controls
const tabActiveBtn = document.getElementById('tab-active-btn');
const tabManualBtn = document.getElementById('tab-manual-btn');
const activeWebsitePanel = document.getElementById('active-website-panel');
const manualPanel = document.getElementById('manual-panel');

// Suggested legal pages list
const suggestedCard = document.getElementById('suggested-card');
const suggestedLinksList = document.getElementById('suggested-links-list');

// Usage Tracking Panel Components
const usagePanel = document.getElementById('usage-panel');
const usagePlanBadge = document.getElementById('usage-plan-badge');
const usageBarFill = document.getElementById('usage-bar-fill');
const usageScansText = document.getElementById('usage-scans-text');
const upgradeBtnLink = document.getElementById('upgrade-btn-link');
const usagePercentageText = document.getElementById('usage-percentage-text');

// Collapsible Folder Components
const headerSecDisagreed = document.getElementById('header-sec-disagreed');
const headerSecAccepted = document.getElementById('header-sec-accepted');
const headerSecNeutral = document.getElementById('header-sec-neutral');
const secDisagreed = document.getElementById('sec-disagreed');
const secAccepted = document.getElementById('sec-accepted');
const secNeutral = document.getElementById('sec-neutral');

let API_BASE_URL = 'https://ais-dev-2qrvrtc44lvwefolakcjbw-179585477098.europe-west1.run.app';
let AUTH_URL = `${API_BASE_URL}/auth`;

// Sync URLs dynamically from storage if populated from dashboard login
async function syncUrls() {
  try {
    let { apiUrl } = await chrome.storage.local.get('apiUrl');
    if (apiUrl) {
      let cleanUrl = apiUrl;
      if (cleanUrl.includes('ais-pre-')) {
        cleanUrl = cleanUrl.replace('ais-pre-', 'ais-dev-');
      }
      API_BASE_URL = cleanUrl;
      AUTH_URL = `${cleanUrl}/auth`;
      console.log(`[Sync] Dynamically synced API URLs: ${API_BASE_URL}`);
    }
  } catch (err) {
    console.warn("Could not sync API URL: ", err);
  }
}

// Initial Check
async function checkAuth() {
  await syncUrls();
  const { token } = await chrome.storage.local.get('token');
  if (token) {
    loginContainer.style.display = 'none';
    mainInterface.style.display = 'block';
    logoutBtn.style.display = 'block';
    if (usagePanel) usagePanel.style.display = 'block';
    statusText.innerText = "Analyzing current view...";
    
    // Render initial usage baseline immediately
    renderUsage({ plan: 'free', analyses_count: 0 });

    // Fetch latest profile and usage stats
    await refreshUsage();
    
    // Auto pull the active tab and extract suggestions
    await detectActiveTabContent();
  } else {
    loginContainer.style.display = 'block';
    mainInterface.style.display = 'none';
    logoutBtn.style.display = 'none';
    if (usagePanel) usagePanel.style.display = 'none';
    suggestedCard.style.display = 'none';
    urlDisplay.style.display = 'none';
    resultsDiv.style.display = 'none';
    footerActions.style.display = 'none';
    statusText.innerText = "Secure login required.";
  }
}
checkAuth();

// Listen for tab changes or navigation to reload side panel content dynamically
if (typeof chrome !== 'undefined' && chrome.tabs) {
  chrome.tabs.onActivated.addListener(() => {
    detectActiveTabContent();
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      detectActiveTabContent();
    }
  });
}

// Listen for storage changes (for automatic sync after login/logout on the web tab)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && (changes.token || changes.apiUrl)) {
    checkAuth();
  }
});

// Logout integration
logoutBtn.addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'apiUrl']);
  checkAuth();
});

// Login integration
loginBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: AUTH_URL });
});

// Tab Switch Logic
tabActiveBtn.addEventListener('click', () => {
  tabActiveBtn.classList.add('active');
  tabManualBtn.classList.remove('active');
  activeWebsitePanel.style.display = 'block';
  manualPanel.style.display = 'none';
});

tabManualBtn.addEventListener('click', () => {
  tabManualBtn.classList.add('active');
  tabActiveBtn.classList.remove('active');
  activeWebsitePanel.style.display = 'none';
  manualPanel.style.display = 'block';
});

// Wire section collapsible triggers
headerSecDisagreed.addEventListener('click', () => {
  secDisagreed.classList.toggle('collapsed');
});
headerSecAccepted.addEventListener('click', () => {
  secAccepted.classList.toggle('collapsed');
});
headerSecNeutral.addEventListener('click', () => {
  secNeutral.classList.toggle('collapsed');
});

// Disable / Enable controls during processing
function disableActionButtons(disabled) {
  scanBtn.disabled = disabled;
  submitManualBtn.disabled = disabled;
  document.querySelectorAll('.link-item-btn').forEach(btn => btn.disabled = disabled);
  if (disabled) {
    scanBtn.style.opacity = "0.5";
    submitManualBtn.style.opacity = "0.5";
  } else {
    scanBtn.style.opacity = "1";
    submitManualBtn.style.opacity = "1";
  }
}

// Fetch Profile and render usage progress bar
async function refreshUsage() {
  const { token } = await chrome.storage.local.get('token');
  if (!token) return;
  try {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/api/profile`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json"
      },
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      renderUsage(data);
    }
  } catch (err) {
    console.error("Could not fetch user profile stats:", err);
  }
}

// Render dynamic usage indicators
function renderUsage(profile) {
  if (!profile) return;
  if (usagePanel) usagePanel.style.display = 'block';

  // 1. Render User Plan
  let plan = (profile.plan || 'free').toUpperCase();
  let count = profile.analyses_count || 0;
  let limit = 5;
  
  if (usagePlanBadge) {
    usagePlanBadge.innerText = plan;
    if (plan !== 'FREE') {
      usagePlanBadge.className = "usage-badge pro";
      limit = profile.billing_cycle === 'yearly' ? 1200 : 100;
    } else {
      usagePlanBadge.className = "usage-badge";
      limit = 5;
    }
  }
  
  // 2. Render Rate of Usage (% and scans)
  const percentage = Math.min(100, Math.round((count / limit) * 100));
  if (usageBarFill) usageBarFill.style.width = `${percentage}%`;
  if (usagePercentageText) usagePercentageText.innerText = `${percentage}%`;
  
  if (usageScansText) {
    if (plan !== 'FREE') {
      if (profile.billing_cycle === 'yearly') {
        usageScansText.innerText = `${count} / ${limit} scans used (${limit}/yr)`;
      } else {
        usageScansText.innerText = `${count} / ${limit} scans used (${limit}/mo)`;
      }
    } else {
      usageScansText.innerText = `${count} / ${limit} monthly scans used`;
    }
  }
  
  // Set Upgrade URL link
  if (upgradeBtnLink) {
    const baseUrl = API_BASE_URL.replace(/\/+$/, '');
    upgradeBtnLink.href = `${baseUrl}/dashboard?tab=upgrade`;
    if (plan !== 'FREE') {
      upgradeBtnLink.innerText = "Active Plan";
    } else {
      upgradeBtnLink.innerText = "Upgrade to Pro";
    }
  }
}

// Detect Active tab structure & suggest legal pages
async function detectActiveTabContent() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
    urlDisplay.style.display = "none";
    suggestedCard.style.display = "none";
    resultsDiv.style.display = "none";
    footerActions.style.display = "none";
    statusText.innerText = "Cannot scan browser internal pages.";
    return;
  }

  // Pure reset: hide previous analysis results and banners instantly when tab/URL navigation happens
  resultsDiv.style.display = "none";
  footerActions.style.display = "none";
  suggestedCard.style.display = "none";
  statusText.innerText = "Ready to scan page content...";
  
  const acceptedList = document.getElementById('accepted-list');
  const disagreedList = document.getElementById('disagreed-list');
  const neutralList = document.getElementById('neutral-list');
  const notifArea = document.getElementById('notification-area');
  
  if (acceptedList) acceptedList.innerHTML = '';
  if (disagreedList) disagreedList.innerHTML = '';
  if (neutralList) neutralList.innerHTML = '';
  if (notifArea) notifArea.innerHTML = '';
  
  let croppedUrl = tab.url;
  if (croppedUrl.length > 55) {
    croppedUrl = croppedUrl.substring(0, 52) + "...";
  }
  urlDisplay.innerText = croppedUrl;
  urlDisplay.style.display = "block";
  
  try {
    let pageData;
    try {
      pageData = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_DATA" });
    } catch (msgErr) {
      console.warn("Script missing, injecting content.js manual fallback...");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 150));
      pageData = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_DATA" });
    }
    
    if (pageData && pageData.links && pageData.links.length > 0) {
      renderSuggestedLinks(pageData.links);
    } else {
      suggestedCard.style.display = "none";
    }
  } catch (err) {
    console.warn("Could not fetch page suggestions dynamically:", err);
    suggestedCard.style.display = "none";
  }
}

// Render list of found legal links allowing users to browse/scan
function renderSuggestedLinks(links) {
  suggestedLinksList.innerHTML = '';
  
  const uniqueLinks = [];
  const seenUrls = new Set();
  
  const keywords = ["terms", "privacy", "tos", "policy", "refund", "legal", "conditions", "user agreement"];
  
  for (const link of links) {
    if (link.url && !seenUrls.has(link.url) && link.url.startsWith('http')) {
      seenUrls.add(link.url);
      
      const text = link.text ? link.text.trim() : "";
      const textLower = text.toLowerCase();
      // Only keep links containing legal keywords for cleaner suggestions
      const isLegal = keywords.some(k => textLower.includes(k));
      if (isLegal && text.length > 0) {
        let textCap = text.charAt(0).toUpperCase() + text.slice(1);
        if (textCap.length > 25) {
          textCap = textCap.substring(0, 22) + "...";
        }
        uniqueLinks.push({ text: textCap, url: link.url });
      }
    }
  }
  
  if (uniqueLinks.length === 0) {
    suggestedCard.style.display = "none";
    return;
  }
  
  // Only display top 5 strongest links to prevent scrolling clutter
  uniqueLinks.slice(0, 5).forEach(link => {
    const item = document.createElement('div');
    item.className = 'link-item';
    item.innerHTML = `
      <span class="link-item-text" title="${link.url}">${link.text}</span>
      <button class="link-item-btn" data-url="${link.url}">Scan Link</button>
    `;
    
    item.querySelector('.link-item-btn').addEventListener('click', async (e) => {
      const url = e.target.getAttribute('data-url');
      statusText.innerText = `Fetching and analyzing text from ${link.text}...`;
      
      try {
        spinner.style.display = "block";
        disableActionButtons(true);
        // Analyze URL without text parameters which triggers fully automated backend fetching
        await runAnalysis("", url);
      } catch (err) {
        handleAnalysisError(err);
      } finally {
        spinner.style.display = "none";
        disableActionButtons(false);
      }
    });
    
    suggestedLinksList.appendChild(item);
  });
  
  suggestedCard.style.display = 'block';
}

// Make a robust API call preserving retry dynamics
async function makeApiRequest(endpoint, token, payload, retries = 2) {
  await syncUrls();
  const baseUrl = API_BASE_URL.replace(/\/+$/, '');
  const cleanEndpoint = endpoint.replace(/^\/+/, '');
  const url = `${baseUrl}/${cleanEndpoint}`;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      console.log(`[Attempt ${attempt + 1}] Calling ${url}`);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      console.log(`Response status: ${response.status}`);
      const contentType = response.headers.get("content-type");

      if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error(`Non-JSON response returned: ${responseText.substring(0, 200)}`);
        
        if (!response.ok) {
          throw new Error(`Server returned HTTP Error ${response.status} from ${url}. Check backend status.`);
        } else {
          throw new Error(`Invalid content response. Received HTML from ${url}. Standard check of routes required.`);
        }
      }

      const data = await response.json();
      
      if (!response.ok) {
        if (data.code === 'LIMIT_REACHED') {
          throw new Error('LIMIT_REACHED: ' + (data.error || 'Scans quota limit reached!'));
        } else if (data.code === 'AUTH_FAILED') {
          throw new Error('AUTH_FAILED');
        } else {
          throw new Error(data.error || data.message || `Failed with Status code: ${response.status}`);
        }
      }

      return data;

    } catch (err) {
      console.error(`[Attempt ${attempt + 1}] Processing failure:`, err.message);
      
      if (err.message.includes('AUTH') || err.message.includes('LIMIT')) {
        throw err;
      }

      if (attempt === retries) {
        throw err;
      }

      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`Retrying after backoff of ${waitTime}ms...`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }
}

// Run summarization pipeline
async function runAnalysis(text, url) {
  const { token } = await chrome.storage.local.get('token');
  if (!token) throw new Error("AUTH_FAILED");

  spinner.style.display = "block";
  disableActionButtons(true);
  
  try {
    resultsDiv.style.display = 'none';
    footerActions.style.display = 'none';
    
    // Safety size truncating
    const MAX_TEXT_LENGTH = 50000;
    let processText = text;
    if (text.length > MAX_TEXT_LENGTH) {
      processText = text.substring(0, MAX_TEXT_LENGTH);
      statusText.innerText = "Truncating policy to size limit...";
    } else if (url && !text) {
      statusText.innerText = "Retrieving and scanning URL...";
    } else {
      statusText.innerText = "Analyzing clauses with AI...";
    }

    const response = await makeApiRequest(
      '/api/summarize',
      token,
      { 
        text: processText, 
        siteUrl: url 
      }
    );

    renderResults(response.summary, response.isPro, response);
    await refreshUsage();

  } catch (err) {
    throw err;
  } finally {
    spinner.style.display = "none";
    disableActionButtons(false);
  }
}

// Render dynamic caching, update or checked banners just like in React template
function renderNotifications(result) {
  const parent = document.getElementById('notification-area');
  parent.innerHTML = '';
  
  const hasEffectiveDate = result.summary && result.summary.effective_date;
  const dateStr = result.summary && result.summary.effective_date ? result.summary.effective_date : '';
  
  let bannerHtml = '';
  
  if (result.changeDetectionRestricted) {
    bannerHtml = `
      <div class="notification-banner restricted">
        <div style="flex-grow: 1">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
            <span class="notification-title">Change Detection Locked (Pro Feature)</span>
            ${hasEffectiveDate ? `<span style="font-size: 10px; font-family: var(--font-mono); font-weight: 700; background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 4px;">Update: ${dateStr}</span>` : ''}
          </div>
          <div class="notification-desc">
            This scan is more than 4 months old! Automated checking of updated effective dates and push alerts is reserved for Professional plan users.
          </div>
          <button class="notification-banner-btn" id="banner-upgrade-btn">Upgrade to Professional</button>
        </div>
      </div>
    `;
  } else if (result.changeDetected) {
    bannerHtml = `
      <div class="notification-banner alert">
        <div style="flex-grow: 1">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
            <span class="notification-title" style="color: var(--color-danger)">Policy Update Alert!</span>
            ${hasEffectiveDate ? `<span style="font-size: 10px; font-family: var(--font-mono); font-weight: 700; background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 4px;">Update: ${dateStr}</span>` : ''}
          </div>
          <div class="notification-desc" style="color: var(--color-danger)">
            Our scanner triggered after 4+ months and detected that the page's effective date updated! We ran a complete AI re-analysis to identify new regulatory risks or terms shifts.
          </div>
        </div>
      </div>
    `;
  } else if (result.cached) {
    bannerHtml = `
      <div class="notification-banner cached">
        <div style="flex-grow: 1">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
            <span class="notification-title">Policy Confirmed (Cached)</span>
            ${hasEffectiveDate ? `<span style="font-size: 10px; font-family: var(--font-mono); font-weight: 700; background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 4px;">Update: ${dateStr}</span>` : ''}
          </div>
          <div class="notification-desc">
            To preserve your monthly API tokens and credits, we retrieved these results instantly from your 4-month cache. Real-time scanning is reserved for when updates actually occur.
          </div>
        </div>
      </div>
    `;
  } else if (result.changeDetected === false && (result.cached === false || result.timestamp)) {
    bannerHtml = `
      <div class="notification-banner checked">
        <div style="flex-grow: 1">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; margin-bottom: 4px;">
            <span class="notification-title" style="color: var(--color-success)">Policy Date Checked & Verified</span>
            ${hasEffectiveDate ? `<span style="font-size: 10px; font-family: var(--font-mono); font-weight: 700; background: rgba(0,0,0,0.05); padding: 1px 4px; border-radius: 4px;">Update: ${dateStr}</span>` : ''}
          </div>
          <div class="notification-desc" style="color: var(--color-success)">
            The 4-month check window has been reached. Our automated verification engine matched the effective date on this URL and verified zero modifications have been made. No analysis credits consumed.
          </div>
        </div>
      </div>
    `;
  }
  
  if (bannerHtml) {
    parent.innerHTML = bannerHtml;
    
    // Handing action upgrades on banners
    const upBtn = document.getElementById('banner-upgrade-btn');
    if (upBtn) {
      upBtn.addEventListener('click', () => {
        const baseUrl = API_BASE_URL.replace(/\/+$/, '');
        chrome.tabs.create({ url: `${baseUrl}/dashboard?tab=upgrade` });
      });
    }
  }
}

// Populate and render AI results details matching point card layouts in dashboard
function renderResults(summary, isPro, resultPayload) {
  document.getElementById('accepted-list').innerHTML = '';
  document.getElementById('disagreed-list').innerHTML = '';
  document.getElementById('neutral-list').innerHTML = '';
  
  const trustScore = 100 - summary.risk_score;
  const scoreCircle = document.getElementById('risk-score');
  scoreCircle.innerText = trustScore;
  document.getElementById('verdict-text').innerText = `"${summary.verdict}"`;
  
  if (trustScore > 80) {
    scoreCircle.style.backgroundColor = 'var(--color-success)';
    document.getElementById('verdict-title').innerText = 'Safe Content';
  } else if (trustScore > 40) {
    scoreCircle.style.backgroundColor = 'var(--color-warning)';
    document.getElementById('verdict-title').innerText = 'Caution Advised';
  } else {
    scoreCircle.style.backgroundColor = 'var(--color-danger)';
    document.getElementById('verdict-title').innerText = 'High Risk';
  }
  
  document.getElementById('pro-priority-badge').innerText = isPro ? 'Pro High-Priority Analysis' : 'Standard Analysis';
  
  // Render notification banners
  renderNotifications(resultPayload);
  
  let countAccepted = 0;
  let countConflict = 0;
  let countNeutral = 0;
  
  summary.summary_points.forEach(point => {
    let listId = 'neutral-list';
    let cardTypeClass = '';
    if (point.status === 'accepted') {
      listId = 'accepted-list';
      cardTypeClass = 'accepted';
      countAccepted++;
    } else if (point.status === 'conflict') {
      listId = 'disagreed-list';
      cardTypeClass = 'conflict';
      countConflict++;
    } else {
      countNeutral++;
    }
    
    const targetList = document.getElementById(listId);
    if (targetList) {
      const card = document.createElement('div');
      card.className = `point-card ${cardTypeClass}`;
      
      const impactBadge = point.impact === 'high' ? `<span class="point-impact-badge">High Impact</span>` : '';
      
      card.innerHTML = `
        <div class="point-card-header">
          <span class="point-category">${point.category || 'General'}</span>
          ${impactBadge}
        </div>
        <div class="point-title">${point.point}</div>
        <div class="point-detail">${point.detail}</div>
      `;
      targetList.appendChild(card);
    }
  });
  
  // Fallback items
  if (countAccepted === 0) {
    document.getElementById('accepted-list').innerHTML = '<div style="font-size: 11px; color: var(--color-slate-500); font-style: italic; padding: 4px;">No standard elements found in this scan.</div>';
  }
  if (countConflict === 0) {
    document.getElementById('disagreed-list').innerHTML = '<div style="font-size: 11px; color: var(--color-success); font-weight: 600; padding: 4px;">Zero high-risk issues flagged! Terms appear highly balanced.</div>';
  }
  if (countNeutral === 0) {
    document.getElementById('neutral-list').innerHTML = '<div style="font-size: 11px; color: var(--color-slate-500); font-style: italic; padding: 4px;">No other supplementary terms detected.</div>';
  }
  
  // Dynamic Folder collapse preferences based on findings
  if (countConflict > 0) {
    secDisagreed.classList.remove('collapsed');
  } else {
    secDisagreed.classList.add('collapsed');
  }
  
  if (countAccepted > 0 && countConflict === 0) {
    secAccepted.classList.remove('collapsed');
  } else {
    secAccepted.classList.add('collapsed');
  }
  
  secNeutral.classList.add('collapsed');
  
  resultsDiv.style.display = 'block';
  footerActions.style.display = 'block';
  statusText.innerText = "Scan results prepared!";
}

// Handle error displays nicely with styled layouts
function handleAnalysisError(err) {
  console.error(err);
  let errorMsg = err.message || "Failed to scan.";
  
  if (errorMsg.startsWith('LIMIT_REACHED')) {
    errorMsg = errorMsg.replace('LIMIT_REACHED: ', '');
    const upgradeUrl = `${API_BASE_URL.replace(/\/+$/, '')}/dashboard?tab=upgrade`;
    statusText.innerHTML = `<span style="color: var(--color-danger); font-weight: 700;">${errorMsg} <a href="${upgradeUrl}" target="_blank" style="color: var(--color-primary); text-decoration: underline;">Upgrade to Pro</a></span>`;
  } else if (errorMsg === 'AUTH_FAILED') {
    statusText.innerText = "Authentication expired. Please login again.";
    loginContainer.style.display = 'block';
    mainInterface.style.display = 'none';
    logoutBtn.style.display = 'none';
    usagePanel.style.display = 'none';
  } else {
    statusText.innerHTML = `<span style="color: var(--color-danger); font-weight: 600;">Error: ${errorMsg}</span>`;
  }
}

// Manual inputs analyze action flow
submitManualBtn.addEventListener('click', async () => {
  const text = manualTextarea.value.trim();
  if (!text || text.length < 50) {
    statusText.innerHTML = '<span style="color: var(--color-danger)">Please paste at least 50 characters of document content.</span>';
    return;
  }
  
  try {
    disableActionButtons(true);
    spinner.style.display = "block";
    statusText.innerText = "Processing pasted text content...";
    await runAnalysis(text, "Manual Paste");
  } catch (err) {
    handleAnalysisError(err);
  } finally {
    spinner.style.display = "none";
    disableActionButtons(false);
  }
});

// Primary active website scanner action flow
scanBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
    statusText.innerText = "Error: Cannot scan browser internal pages.";
    return;
  }

  statusText.innerText = "Scraping page markup content...";
  disableActionButtons(true);
  spinner.style.display = "block";

  try {
    let pageData;
    try {
      pageData = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_DATA" });
    } catch (msgErr) {
      console.warn("Retrying message channel injection content...");
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 150));
      pageData = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_DATA" });
    }

    if (!pageData || !pageData.content) {
      throw new Error("Target page returned empty content. Try scanning a specific suggested link.");
    }

    statusText.innerText = "Analyzing browser content...";
    await runAnalysis(pageData.content, pageData.url);
  } catch (err) {
    handleAnalysisError(err);
  } finally {
    spinner.style.display = "none";
    disableActionButtons(false);
  }
});

// Clear and scan fresh control
clearBtn.addEventListener('click', () => {
  resultsDiv.style.display = 'none';
  footerActions.style.display = 'none';
  manualTextarea.value = '';
  statusText.innerText = "Ready for new scans...";
  detectActiveTabContent();
});
