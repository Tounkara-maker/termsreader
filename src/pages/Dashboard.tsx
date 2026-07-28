import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Shield, Settings, History, Sidebar, ChevronRight, Activity, Loader2, AlertCircle, CheckCircle2, XCircle, Info, Zap, Crown, User, ExternalLink, Calendar, Lock, Save, KeyRound, Eye, EyeOff, RefreshCw } from "lucide-react";
import PreferenceChecklist from "../components/PreferenceChecklist";
import { useAuth } from "../contexts/AuthContext";
import PaddleCheckoutModal from "../components/PaddleCheckoutModal";

export default function Dashboard() {
  const { profile, session, refreshProfile, signOut } = useAuth();
  const safeBillingCycle = (() => {
    if (!profile) return null;
    
    // Check if plan string contains suffix (e.g. pro-yearly or pro-monthly)
    const planStr = String(profile.plan || "");
    if (planStr.toLowerCase() === "free") return null;
    
    if (planStr.includes("_") || planStr.includes("-")) {
      const separator = planStr.includes("_") ? "_" : "-";
      const [basePlan, cycle] = planStr.split(separator);
      if (basePlan.toLowerCase() === "free") return null;
      return (cycle.toLowerCase().includes("year") || cycle.toLowerCase().includes("yearly") || cycle.toLowerCase().includes("annual")) ? "yearly" : "monthly";
    }

    if (!profile.billing_cycle) {
      if (planStr.toLowerCase().includes("pro")) {
        return "monthly"; // Default pro to monthly
      }
      return null;
    }
    
    const cycle = profile.billing_cycle;
    if (typeof cycle === "string") {
      const trimmed = cycle.trim();
      if (trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          const val = parsed.interval || parsed.Interval || "monthly";
          return String(val).toLowerCase().includes("year") ? "yearly" : "monthly";
        } catch (_) {}
      }
      return (trimmed.toLowerCase().includes("year") || trimmed.toLowerCase().includes("yearly") || trimmed.toLowerCase().includes("annual")) ? "yearly" : "monthly";
    }
    if (typeof cycle === "object") {
      const val = cycle.interval || cycle.Interval || "monthly";
      return String(val).toLowerCase().includes("year") ? "yearly" : "monthly";
    }
    return "monthly";
  })();

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [testUrl, setTestUrl] = useState("https://example.com/privacy");
  const [manualText, setManualText] = useState("");
  const [inputType, setInputType] = useState<"url" | "text">("url");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);
  
  // Tab logic using URL search params
  const activeTab = searchParams.get("tab") || "preferences";
  const setActiveTab = (tab: string) => setSearchParams({ tab });

  const [pendingPrefs, setPendingPrefs] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [cancelling, setCancelling] = useState(false);
  const [cancellationError, setCancellationError] = useState<string | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Settings Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      if (profile.first_name) setFirstName(profile.first_name);
      if (profile.last_name) setLastName(profile.last_name);
      if (!profile.first_name && !profile.last_name && profile.full_name) {
        const parts = profile.full_name.split(" ");
        setFirstName(parts[0] || "");
        setLastName(parts.slice(1).join(" ") || "");
      }
    }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setUpdatingProfile(true);
    setProfileMessage(null);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ firstName, lastName })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setProfileMessage({ type: 'success', text: "Profile name updated successfully!" });
        await refreshProfile();
      } else {
        setProfileMessage({ type: 'error', text: data.error || "Failed to update profile." });
      }
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || "A network error occurred." });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: "Password must be at least 6 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: "Passwords do not match." });
      return;
    }

    setUpdatingPassword(true);
    setPasswordMessage(null);
    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPasswordMessage({ type: 'success', text: "Your password has been changed successfully!" });
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setPasswordMessage({ type: 'error', text: data.error || "Failed to update password." });
      }
    } catch (err: any) {
      setPasswordMessage({ type: 'error', text: err.message || "A network error occurred." });
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSyncPlan = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/profile/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.synced) {
          await refreshProfile();
          setSyncMessage({ type: 'success', text: `Successfully synchronised with Paddle! Active plan: ${data.billing_cycle || 'monthly'}.` });
        } else {
          setSyncMessage({ type: 'error', text: data.message || "No active subscription found on Paddle to sync." });
        }
      } else {
        const data = await res.json().catch(() => ({}));
        setSyncMessage({ type: 'error', text: data.error || "Failed to sync subscription details with Paddle." });
      }
    } catch (err: any) {
      setSyncMessage({ type: 'error', text: err.message || "A network error occurred." });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && session) {
      fetchHistory();
    }
  }, [activeTab, session]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/scans", {
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      } else if (res.status === 401) {
        await signOut();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const savePreferences = async () => {
    if (!pendingPrefs || !session) return;
    setSaving(true);
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ preferences: pendingPrefs })
      });
      if (res.ok) {
        await refreshProfile();
      } else if (res.status === 401) {
        await signOut();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
      setPendingPrefs(null);
    }
  };

  const runTestAnalysis = async () => {
    if (!session) return;
    setAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          siteUrl: inputType === "url" ? testUrl : "",
          text: inputType === "text" ? manualText : ""
        })
      });

      // Handle non-JSON responses (like 502/504 HTML error pages from the load balancer)
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Non-JSON response received:", await res.text());
        throw new Error("The server returned an unexpected response. It may be timing out or under heavy load. Please try again or use the manual text option.");
      }

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          await signOut();
          return;
        }
        // Build a more helpful error message based on the code
        let msg: any = data.error || "Analysis failed";
        const code = data.code;
        
        if (code === "TIMEOUT" || code === "DNS_ERROR" || code === "CONNECTION_REFUSED" || code === "SCRAPING_FAILED" || code === "HTTP_ERROR" || code === "FETCH_ERROR") {
          msg = (
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-red-600">Scan Failed: {data.error}</p>
                  <p className="text-slate-600 text-sm mt-1 leading-relaxed">
                    Our server was unable to retrieve content from <strong>{testUrl}</strong>. 
                    This happens when sites block automated access or have DNS issues.
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50/70 p-4 rounded-xl border border-blue-100 mt-2 text-left">
                <div className="flex items-center gap-2 text-blue-800 text-sm font-bold mb-2">
                  <Sidebar className="w-4 h-4" />
                  Try Manual Input
                </div>
                <p className="text-blue-700 text-xs leading-relaxed mb-3">
                  You can copy and paste the terms of service text manually to scan it with AI.
                </p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setInputType("text");
                      setError(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all"
                  >
                    Switch to Manual Text
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        }
        setError(msg);
        return;
      }
      
      setResult(data);
      await refreshProfile();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const upgradeToPro = async (type: "monthly" | "yearly" = "monthly") => {
    if (!session) return;
    setUpgrading(true);
    try {
      const res = await fetch("/api/profile/upgrade", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ planType: type })
      });
      if (res.ok) {
        await refreshProfile();
        setActiveTab("preferences");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const confirmMsg = "Are you sure you want to cancel your Professional plan? Your subscription will remain active until the end of your current billing period, and it will not renew.";
    if (!session || !window.confirm(confirmMsg)) return;

    setCancelling(true);
    setCancellationError(null);

    try {
      // 1. First, attempt to open the Paddle Customer Portal
      const portalRes = await fetch("/api/profile/portal-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        }
      });
      const data = await portalRes.json();

      if (portalRes.ok && data.success && data.portal_url) {
        console.log("[Paddle Portal Session Success] Opening portal url:", data.portal_url);
        window.open(data.portal_url, "_blank", "noopener,noreferrer");

        // Schedule local cancellation at end of period in the database to keep state in sync
        await fetch("/api/profile/cancel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ effective_from: "next_billing_period" })
        });
        await refreshProfile();
      } else {
        // If they don't have a live Paddle subscription (e.g., Sandbox or Demo Mode), 
        // fallback to updating the database locally with end-of-period cancellation.
        console.log("[Portal Fallback] Simulating end-of-period cancellation locally.");
        const cancelRes = await fetch("/api/profile/cancel", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ effective_from: "next_billing_period" })
        });

        if (cancelRes.ok) {
          await refreshProfile();
        } else {
          const cancelData = await cancelRes.json().catch(() => ({}));
          setCancellationError(cancelData.error || data.error || "An error occurred while scheduling your cancellation.");
        }
      }
    } catch (err: any) {
      console.error("Cancel action error:", err);
      setCancellationError(err?.message || "A network error occurred while canceling your subscription.");
    } finally {
      setCancelling(false);
    }
  };

  const userFirstName = profile?.first_name || firstName || "";
  const userLastName = profile?.last_name || lastName || "";
  const hasFirstOrLastName = Boolean(userFirstName.trim() || userLastName.trim());

  const displayName = hasFirstOrLastName
    ? `${userFirstName} ${userLastName}`.trim()
    : (profile?.full_name && profile.full_name !== session?.user?.email?.split('@')[0] ? profile.full_name : (session?.user?.email || "User"));

  const avatarInitial = (userFirstName ? userFirstName.charAt(0) : (displayName ? displayName.charAt(0) : "U")).toUpperCase();

  return (
    <div className="max-w-7xl mx-auto py-10 px-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 space-y-1">
          <div className="px-4 pb-4 mb-4 border-b border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">My Account</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-sm">
                {avatarInitial}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-800 truncate" title={displayName}>
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 font-medium truncate mb-1" title={session?.user.email}>
                  {session?.user.email}
                </p>
                <div className={`text-[9px] font-black uppercase tracking-tighter inline-flex px-1.5 py-0.5 rounded ${
                  profile?.plan === 'pro' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  {profile?.plan || "Free"} {safeBillingCycle ? `(${safeBillingCycle})` : ""} Plan
                </div>
              </div>
            </div>

            {profile && (
              <div className="mt-4 pt-4 border-t border-slate-100/80">
                <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-500 mb-2">
                  <span className="uppercase tracking-wider">
                    {safeBillingCycle === 'yearly' ? "Yearly Usage" : "Monthly Usage"}
                  </span>
                  <span className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                    {profile.analyses_count || 0} / {profile.plan === 'pro' ? (safeBillingCycle === 'yearly' ? 1200 : 100) : 5}
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-1000 ${
                      profile.plan === 'pro' ? 'bg-indigo-600' : 'bg-blue-600'
                    }`}
                    style={{ 
                      width: `${Math.min(100, ((profile.analyses_count || 0) / (profile.plan === 'pro' ? (safeBillingCycle === 'yearly' ? 1200 : 100) : 5)) * 100)}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[9px] text-slate-400 font-semibold">
                    {safeBillingCycle === 'yearly' ? "Resets yearly" : "Resets monthly"}
                  </span>
                  {profile.plan === 'free' && (
                    <button 
                      onClick={() => setActiveTab("upgrade")}
                      className="text-[9px] text-blue-600 font-bold hover:underline"
                    >
                      Get more scans →
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <NavItem 
            icon={<Shield className="w-4 h-4" />} 
            label="Preferences" 
            active={activeTab === "preferences"} 
            onClick={() => setActiveTab("preferences")}
          />
          <NavItem 
            icon={<Activity className="w-4 h-4" />} 
            label="Test Analysis" 
            active={activeTab === "test"} 
            onClick={() => setActiveTab("test")}
          />
          <NavItem 
            icon={<History className="w-4 h-4" />} 
            label="Scan History" 
            active={activeTab === "history"}
            onClick={() => setActiveTab("history")}
          />
          <NavItem 
            icon={<Zap className="w-4 h-4" />} 
            label="Upgrade Plan" 
            active={activeTab === "upgrade"}
            onClick={() => setActiveTab("upgrade")}
          />
          <div className="pt-4 mt-4 border-t border-slate-100">
            <NavItem 
              icon={<Settings className="w-4 h-4" />} 
              label="Settings" 
              active={activeTab === "settings"}
              onClick={() => setActiveTab("settings")}
            />
          </div>
        </aside>

        {/* Content Area */}
        <div className="flex-grow flex flex-col gap-8">
          {!hasFirstOrLastName && activeTab !== "settings" && (
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-100 p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-in fade-in duration-300">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 font-black text-sm shadow-md shadow-blue-200">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-extrabold text-slate-900 tracking-tight">Please complete your profile details</p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Add your First Name and Last Name so your dashboard displays your full name instead of your raw email.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveTab("settings")}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 shadow-md shadow-blue-200 flex items-center gap-2"
              >
                <Settings className="w-3.5 h-3.5" />
                Complete Profile in Settings
              </button>
            </div>
          )}

          {activeTab === "upgrade" && (
            <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-300">
              <div className="p-12 text-center max-w-2xl mx-auto">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Crown className="w-8 h-8" />
                </div>
                
                {profile?.plan === 'pro' ? (
                  <>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">You're a Professional</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">
                      Thank you for supporting Termsreader! You currently have the <strong>{safeBillingCycle || 'monthly'}</strong> plan active.
                    </p>
                    
                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Active Plan</p>
                          <p className="text-xl font-black text-slate-900 capitalize">Pro {safeBillingCycle || 'Monthly'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Status</p>
                          <p className={`text-xl font-black ${profile.cancel_at_period_end ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`}>
                            {profile.cancel_at_period_end ? 'Cancellation Pending' : 'Active'}
                          </p>
                        </div>
                      </div>

                      {profile.cancel_at_period_end ? (
                        <div className="w-full bg-amber-50 text-amber-800 p-4 rounded-xl font-semibold text-xs leading-relaxed text-left border border-amber-100/70 flex items-start gap-2.5">
                          <Calendar className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                          <div>
                            <p className="font-extrabold text-[10px] uppercase tracking-wider text-amber-700 mb-0.5">Scheduled Cancellation</p>
                            Your access to Pro features remains fully active until the next billing date. Your subscription will not renew.
                          </div>
                        </div>
                      ) : (
                        <div className="w-full bg-emerald-500/10 text-emerald-600 py-3 rounded-xl font-bold text-sm">
                          Professional Access Enabled
                        </div>
                      )}
                    </div>

                    {syncMessage && (
                      <div className={`mb-6 p-4 rounded-2xl text-left border flex items-start gap-3 ${
                        syncMessage.type === 'success' 
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                          : 'bg-rose-50 border-rose-100 text-rose-800'
                      }`}>
                        <div className="text-xs font-semibold">
                          {syncMessage.text}
                        </div>
                      </div>
                    )}



                    {cancellationError && (
                      <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-100 flex items-start gap-3 text-left">
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-xs font-extrabold text-rose-800 uppercase tracking-widest mb-1">Paddle Action Failed</h4>
                          <p className="text-xs text-rose-600 font-medium leading-normal">{cancellationError}</p>
                        </div>
                      </div>
                    )}

                    {!profile.cancel_at_period_end && (
                      <div className="space-y-4">
                        <p className="text-xs text-slate-500 text-left leading-relaxed">
                          Clicking the button below will securely process your cancellation request. Your access to Professional plan features will remain fully active until the end of your current billing period, after which your subscription will not renew.
                        </p>
                        
                        <button 
                          onClick={handleCancelSubscription}
                          disabled={cancelling}
                          className="w-full py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-200 disabled:opacity-50"
                        >
                          {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                          Cancel Subscription
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Unlock Professional Protection</h2>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">
                      Get {billingCycle === 'monthly' ? '100' : '1200'} site analyses, change detection alerts, and priority processing with our Professional plan.
                    </p>

                    {/* Cycle Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl w-fit mx-auto mb-10">
                      <button 
                        onClick={() => setBillingCycle("monthly")}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${billingCycle === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Monthly
                      </button>
                      <button 
                        onClick={() => setBillingCycle("yearly")}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all relative ${billingCycle === 'yearly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Yearly
                        <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full border-2 border-white">Save 20%</span>
                      </button>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4 mb-10 text-left">
                      {[
                        billingCycle === 'monthly' ? "100 analyses" : "1200 analyses",
                        "Preference matching",
                        "Priority accuracy",
                        "History cloud sync",
                        "Change monitoring",
                        "Advanced summaries"
                      ].map((f, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          {f}
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                      <div className="mb-6">
                        <span className="text-4xl font-black text-slate-900">{billingCycle === 'monthly' ? '$12' : '$108'}</span>
                        <span className="text-slate-400 font-bold ml-2">/ {billingCycle === 'monthly' ? 'month' : 'year'}</span>
                      </div>
                      <button 
                        onClick={() => setIsCheckoutOpen(true)}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 transition-all flex items-center justify-center gap-3"
                      >
                        Get Professional Now
                      </button>
                      <p className="mt-4 text-[11px] text-slate-400 font-bold uppercase tracking-widest">No long-term commitment. Cancel anytime.</p>

                      <div className="mt-6 pt-6 border-t border-slate-200/80 flex flex-col items-center gap-3">
                        <button
                          onClick={handleSyncPlan}
                          disabled={syncing}
                          className="text-xs font-bold text-slate-600 hover:text-blue-600 flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
                          Already subscribed? Sync Paddle Status
                        </button>
                        {syncMessage && (
                          <div className={`p-3 rounded-xl text-xs font-semibold w-full text-center ${
                            syncMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-amber-50 text-amber-800 border border-amber-100'
                          }`}>
                            {syncMessage.text}
                          </div>
                        )}
                      </div>
                    </div>

                    <PaddleCheckoutModal
                      isOpen={isCheckoutOpen}
                      onClose={() => setIsCheckoutOpen(false)}
                      planType={billingCycle}
                      userSession={session}
                      onSuccess={() => {
                        refreshProfile();
                        setActiveTab("preferences");
                      }}
                    />
                  </>

                )}
              </div>
            </section>
          )}

          {profile?.is_demo && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
              <div className="bg-amber-100 p-2 rounded-lg text-amber-600">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-800">Demo Mode Active</h4>
                <p className="text-xs text-amber-700 font-medium mt-0.5">
                  Database keys are not configured in the environment. Your preferences won't persist across sessions.
                </p>
              </div>
              <button 
                onClick={() => window.open("/settings", "_blank")}
                className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors"
              >
                Configure Keys
              </button>
            </div>
          )}

          {activeTab === "preferences" && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-white">
                <h2 className="text-lg font-bold text-slate-800">Policy Preferences</h2>
                <p className="text-xs text-slate-500 mt-1">Check elements you normally accept to highlight deviations.</p>
              </div>
              
              <div className="p-8 relative">
                {profile ? (
                  profile.plan === "pro" ? (
                    <PreferenceChecklist 
                      initialPreferences={profile.preferences} 
                      onSave={(p) => setPendingPrefs(p)}
                    />
                  ) : (
                    <div className="relative">
                      {/* Blurred and disabled preview of preference checklist */}
                      <div className="pointer-events-none opacity-20 blur-[3px]">
                        <PreferenceChecklist />
                      </div>
                      
                      {/* Premium upgrade wall content */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-white/40 backdrop-blur-[1px]">
                        <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-md shadow-indigo-100/50">
                          <Crown className="w-8 h-8 animate-pulse" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Lock in Custom Preferences</h3>
                        <p className="text-slate-500 font-medium max-w-md mx-auto text-sm leading-relaxed mb-8">
                          Define your personal legal and data collection templates. Our AI cross-references and highlights direct conflicts automatically in your browser sidebar.
                        </p>
                        <button 
                          onClick={() => setActiveTab("upgrade")}
                          className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 shrink-0"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          Upgrade to Professional
                        </button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" /></div>
                )}
              </div>

              {profile?.plan === "pro" && (
                <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-medium tracking-tight">
                    {pendingPrefs ? "Changes unsaved" : "Settings synced with extension"}
                  </span>
                  <button 
                    onClick={savePreferences}
                    disabled={!pendingPrefs || saving}
                    className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save Settings
                  </button>
                </div>
              )}
            </section>
          )}

          {activeTab === "history" && (
            <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
              <div className="p-6 border-b border-slate-100 bg-white">
                <h2 className="text-lg font-bold text-slate-800">Scan History</h2>
                <p className="text-xs text-slate-500 mt-1">Recent analyses performed by yours truly.</p>
              </div>
              <div className="p-0">
                {loadingHistory ? (
                  <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" /></div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <History className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">No scans yet. Try the test analysis!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {history.map((scan) => (
                      <div key={scan.id} className="p-6 hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => {
                        setResult({ 
                          summary: scan.summary, 
                          isPro: profile?.plan === 'pro',
                          cached: true 
                        });
                        setActiveTab("test");
                      }}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              scan.summary.risk_score > 60 ? 'bg-red-100 text-red-600' : 
                              scan.summary.risk_score > 30 ? 'bg-amber-100 text-amber-600' : 
                              'bg-emerald-100 text-emerald-600'
                            }`}>
                              <Shield className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-800 break-all">{scan.site_url || "Manual Paste"}</h4>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                  {new Date(scan.created_at).toLocaleDateString()} at {new Date(scan.created_at).toLocaleTimeString()}
                                </p>
                                {scan.summary?.effective_date && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono font-black tracking-tight bg-slate-100 text-slate-400 border border-slate-200">
                                    Last update: {scan.summary.effective_date}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-bold text-slate-400 mb-0.5 uppercase tracking-tighter">Risk Score</div>
                            <div className={`text-lg font-black ${
                              scan.summary.risk_score > 60 ? 'text-red-500' : 
                              scan.summary.risk_score > 30 ? 'text-amber-500' : 
                              'text-emerald-500'
                            }`}>
                              {scan.summary.risk_score}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === "test" && (
            <section className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-800">Simulate Website Analysis</h2>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setInputType("url")}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${inputType === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      URL
                    </button>
                    <button 
                      onClick={() => setInputType("text")}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${inputType === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                    >
                      Manual Text
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {inputType === "url" ? (
                    <div className="flex gap-4">
                      <input 
                        type="url" 
                        value={testUrl}
                        onChange={(e) => setTestUrl(e.target.value)}
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all"
                        placeholder="https://example.com/privacy-policy"
                      />
                      <button 
                        onClick={runTestAnalysis}
                        disabled={analyzing}
                        className="px-6 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze URL"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <textarea 
                        value={manualText}
                        onChange={(e) => setManualText(e.target.value)}
                        className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 transition-all resize-none"
                        placeholder="Paste the full privacy policy or terms of service text here..."
                      />
                      <button 
                        onClick={runTestAnalysis}
                        disabled={analyzing || !manualText}
                        className="w-full py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Analyze Text Content"}
                      </button>
                    </div>
                  )}
                </div>
                {error && (
                  <div className={`mt-4 p-4 rounded-xl border flex items-start gap-3 text-sm ${typeof error === 'string' ? 'bg-red-50 border-red-100 text-red-600 items-center' : 'bg-white border-slate-200 shadow-sm'}`}>
                    {typeof error === 'string' && <AlertCircle className="w-4 h-4 shrink-0" />}
                    <div className="flex-1">{error}</div>
                  </div>
                )}
              </div>

              {result && (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">Analysis Results</h3>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">
                        {result.isPro ? "Pro High-Priority Analysis" : "Standard Analysis"}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs font-bold text-slate-500">Risk Score</div>
                        <div className={`text-xl font-black ${result.summary.risk_score > 60 ? 'text-red-500' : result.summary.risk_score > 30 ? 'text-amber-500' : 'text-emerald-500'}`}>
                          {result.summary.risk_score}/100
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8 space-y-6">
                    {/* Dynamic Notification/Alert Banner for Cached, Changed, or Checked Scans */}
                    {(result.cached || result.changeDetected !== undefined || result.summary?.effective_date || result.changeDetectionRestricted) && (
                      <div className={`p-5 rounded-2xl border flex items-start gap-4 text-xs font-semibold shadow-sm transition-all duration-300 ${
                        result.changeDetectionRestricted
                          ? "bg-indigo-50 border-indigo-100 text-indigo-900"
                          : result.changeDetected 
                            ? "bg-rose-50 border-rose-100 text-rose-800" 
                            : result.cached
                              ? "bg-slate-50 border-slate-200 text-slate-700"
                              : "bg-emerald-50 border-emerald-100 text-emerald-800"
                      }`}>
                        <div className={`p-2.5 rounded-xl shrink-0 flex items-center justify-center ${
                          result.changeDetectionRestricted
                            ? "bg-indigo-100 text-indigo-600 shadow-sm shadow-indigo-200"
                            : result.changeDetected 
                              ? "bg-rose-100 text-rose-600 shadow-sm shadow-rose-200" 
                              : result.cached
                                ? "bg-slate-200 text-slate-600 shadow-sm shadow-slate-100"
                                : "bg-emerald-100 text-emerald-600 shadow-sm shadow-emerald-200"
                        }`}>
                          {result.changeDetectionRestricted ? <Crown className="w-5 h-5" /> : result.changeDetected ? <Activity className="w-5 h-5 animate-pulse" /> : <Shield className="w-5 h-5" />}
                        </div>
                        <div className="flex-grow">
                          <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
                            <span className="font-bold text-sm tracking-tight">
                              {result.changeDetectionRestricted
                                ? "Change Detection Locked (Pro Feature)"
                                : result.changeDetected 
                                  ? "Policy Update Alert!" 
                                  : result.cached
                                    ? "Policy Confirmed (Cached)"
                                    : "Policy Date Checked & Verified"
                              }
                            </span>
                            {result.summary?.effective_date && (
                              <span className="text-[10px] bg-white/80 px-2.5 py-1 rounded-lg shadow-sm border font-mono font-bold tracking-tight text-slate-600">
                                Last update: {result.summary.effective_date}
                              </span>
                            )}
                          </div>
                          <p className="font-medium text-slate-500 leading-relaxed text-[11px] mb-3">
                            {result.changeDetectionRestricted
                              ? "This scan is more than 4 months old! Automated checking of updated effective dates and push alerts is reserved for Professional plan users."
                              : result.changeDetected 
                                ? "Our scanner triggered after 4+ months and detected that the page's effective date updated! We ran a complete AI re-analysis to identify new regulatory risks or terms shifts." 
                                : result.cached
                                  ? "To preserve your monthly API tokens and credits, we retrieved these results instantly from your 4-month cache. Real-time scanning is reserved for when updates actually occur."
                                  : "The 4-month check window has been reached. Our automated verification engine matched the effective date on this URL and verified zero modifications have been made. No analysis credits consumed."
                            }
                          </p>
                          {result.changeDetectionRestricted && (
                            <button
                              onClick={() => setActiveTab("upgrade")}
                              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center gap-1.5 text-[10px]"
                            >
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              Upgrade to Professional
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {!result.scrapingSuccess && inputType === 'url' && (
                      <div className="p-4 bg-amber-50/70 border border-amber-100 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Live Content Extraction Unavailable.</span> We couldn't fetch text content directly from this page (it might block automated access, or be a placeholder/dummy domain). Gemini utilized search grounding fallbacks instead. For accurate analysis of draft policies or test sites, please switch to the <strong>Manual Text</strong> option and copy-paste the text directly.
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-blue-800 text-sm italic font-medium">
                      "{result.summary.verdict}"
                    </div>

                    <div className="grid gap-4">
                      {result.summary.summary_points.map((point: any, i: number) => (
                        <div key={i} className={`p-5 rounded-2xl border transition-all ${
                          point.status === 'conflict' ? 'bg-red-50/50 border-red-100' : 
                          point.status === 'accepted' ? 'bg-emerald-50/50 border-emerald-100' : 
                          'bg-slate-50 border-slate-100'
                        }`}>
                          <div className="flex items-start gap-4">
                            <div className={`p-2 rounded-lg shrink-0 ${
                              point.status === 'conflict' ? 'bg-red-100 text-red-600' : 
                              point.status === 'accepted' ? 'bg-emerald-100 text-emerald-600' : 
                              'bg-slate-200 text-slate-600'
                            }`}>
                              {point.status === 'conflict' ? <XCircle className="w-5 h-5" /> : 
                               point.status === 'accepted' ? <CheckCircle2 className="w-5 h-5" /> : 
                               <Info className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold uppercase tracking-wider opacity-60">{point.category}</span>
                                {point.impact === 'high' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-600 uppercase">High Impact</span>
                                )}
                              </div>
                              <h4 className="text-sm font-bold text-slate-800 mb-1">{point.point}</h4>
                              <p className="text-xs text-slate-500 leading-relaxed font-medium">{point.detail}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === "settings" && (
            <section className="space-y-8 animate-in fade-in duration-300">
              {/* Profile Details Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                      <User className="w-5 h-5 text-blue-600" />
                      Account Information
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      Manage your personal profile details and display settings.
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                    User Profile
                  </span>
                </div>

                <form onSubmit={handleUpdateProfile} className="p-8 space-y-6">
                  {profileMessage && (
                    <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 border ${
                      profileMessage.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                        : 'bg-rose-50 border-rose-100 text-rose-800'
                    }`}>
                      {profileMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                      <span>{profileMessage.text}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Email Address
                    </label>
                    <div className="flex items-center gap-3 px-4 py-3 bg-slate-100/70 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-700 cursor-not-allowed">
                      <User className="w-4 h-4 text-slate-400" />
                      <span className="flex-1 truncate">{session?.user.email}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md">Verified</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-medium mt-1.5">
                      Your email address is linked to your account and browser extension synchronization.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        First Name
                      </label>
                      <input 
                        type="text" 
                        value={firstName} 
                        onChange={(e) => setFirstName(e.target.value)} 
                        placeholder="e.g. Jane"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Last Name
                      </label>
                      <input 
                        type="text" 
                        value={lastName} 
                        onChange={(e) => setLastName(e.target.value)} 
                        placeholder="e.g. Doe"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button 
                      type="submit" 
                      disabled={updatingProfile}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {updatingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Profile
                    </button>
                  </div>
                </form>
              </div>

              {/* Security & Change Password Card */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                  <h2 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                    <KeyRound className="w-5 h-5 text-indigo-600" />
                    Password & Security
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Update your account password to maintain security across your extension and web dashboard.
                  </p>
                </div>

                <form onSubmit={handleChangePassword} className="p-8 space-y-6">
                  {passwordMessage && (
                    <div className={`p-4 rounded-2xl text-xs font-semibold flex items-center gap-2.5 border ${
                      passwordMessage.type === 'success' 
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                        : 'bg-rose-50 border-rose-100 text-rose-800'
                    }`}>
                      {passwordMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
                      <span>{passwordMessage.text}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          value={newPassword} 
                          onChange={(e) => setNewPassword(e.target.value)} 
                          placeholder="Minimum 6 characters"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all pr-10"
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Confirm New Password
                      </label>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Re-enter password"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <p className="text-[11px] text-slate-400 font-medium">
                      Password must be at least 6 characters.
                    </p>
                    <button 
                      type="submit" 
                      disabled={updatingPassword || !newPassword}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {updatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                      Update Password
                    </button>
                  </div>
                </form>
              </div>
            </section>
          )}

          <div className="w-full">
            <div className={`p-8 rounded-2xl text-white pricing-card ring-4 ${profile?.plan === 'pro' ? 'bg-indigo-600 ring-indigo-100' : 'bg-blue-600 ring-blue-100'}`}>
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-blue-200" />
                <h3 className="text-xl font-bold">Plan Details</h3>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-blue-200">
                  <span>Current Plan</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded">{profile?.plan?.toUpperCase() || "..."}</span>
                </div>
                {profile?.plan === 'free' ? (
                  <>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-1000" 
                        style={{ width: `${Math.min(100, ((profile?.analyses_count || 0) / 5) * 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-[11px] text-blue-100 font-medium italic opacity-80">{profile?.analyses_count || 0}/5 monthly scans used</p>
                      <button 
                        onClick={() => setActiveTab("upgrade")}
                        className="text-xs font-bold bg-white text-blue-600 px-3 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                      >
                        Upgrade Now
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-white transition-all duration-1000" 
                        style={{ 
                          width: `${Math.min(100, ((profile?.analyses_count || 0) / (safeBillingCycle === 'yearly' ? 1200 : 100)) * 100)}%` 
                        }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-[11px] text-blue-100 font-medium italic opacity-80">
                        {profile?.analyses_count || 0}/{safeBillingCycle === 'yearly' ? '1200' : '100'} scans used (limit: {safeBillingCycle === 'yearly' ? '1200/year' : '100/month'})
                      </p>
                      <span className="text-[10px] text-emerald-200 font-bold bg-emerald-500/30 px-2 py-0.5 rounded">
                        Active
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
        active ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
