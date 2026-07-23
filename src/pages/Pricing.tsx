import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldAlert, Check, X, Info, AlertCircle, Crown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import PaddleCheckoutModal from "../components/PaddleCheckoutModal";

export default function Pricing() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [showUpsellMsg, setShowUpsellMsg] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPlanType, setSelectedPlanType] = useState<"monthly" | "yearly">("monthly");

  const proFeaturesMonthly = [
    "Privacy policy summaries",
    "Terms & conditions summaries",
    "100 site analyses",
    "Chrome Extension Support",
    "Detailed bullet-point summaries",
    "Preference matching (color-coded)",
    "Change detection & alerts",
    "Extra terms page coverage",
    "Priority analysis speed"
  ];

  const proFeaturesYearly = [
    "Privacy policy summaries",
    "Terms & conditions summaries",
    "1200 site analyses",
    "Chrome Extension Support",
    "Detailed bullet-point summaries",
    "Preference matching (color-coded)",
    "Change detection & alerts",
    "Extra terms page coverage",
    "Priority analysis speed"
  ];

  const freeFeatures = [
    "Privacy policy summaries",
    "Terms & conditions summaries",
    "5 site analyses per month",
    "Chrome Extension Support",
    "Standard Sidebar UI",
    "Basic bullet-point summaries"
  ];

  const handleProClick = (type: "monthly" | "yearly") => {
    if (session) {
      setSelectedPlanType(type);
      setIsCheckoutOpen(true);
    } else {
      setShowUpsellMsg(true);
    }
  };

  const handleFreeClick = () => {
    if (session) {
      navigate("/dashboard");
    } else {
      navigate("/auth");
    }
  };

  return (
    <div className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 min-h-[calc(100vh-112px)] flex flex-col items-center relative">
      <AnimatePresence>
        {showUpsellMsg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpsellMsg(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md w-full border border-slate-200"
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Crown className="w-8 h-8" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Get started with Pro</h3>
                <p className="text-slate-500 font-medium leading-relaxed mb-8 px-2">
                  You need an account to upgrade to Pro. Create one now or sign in if you already have one.
                </p>

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => navigate("/auth")}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 transition-all active:scale-95"
                  >
                    Create account
                  </button>
                  <button 
                    onClick={() => navigate("/auth")}
                    className="w-full py-4 bg-slate-100 text-slate-800 rounded-2xl font-black text-lg hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Sign in & upgrade
                  </button>
                </div>

                <button 
                  onClick={() => setShowUpsellMsg(false)}
                  className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="bg-slate-50 p-4 border-t border-slate-100 text-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Safe & Secure Payments via Paddle</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto text-center mb-12">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Select Your Plan</h2>
        <p className="text-sm text-slate-500">Secure payments processed by Checkout</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
        {/* Personal Use / Free Plan */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col pricing-card">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Personal Use</span>
          <h3 className="text-3xl font-bold text-slate-800 mt-2">Free</h3>
          <p className="text-sm text-slate-500 mt-4 leading-relaxed">Basic privacy and terms summarization for occasional use.</p>
          <ul className="mt-8 space-y-4 flex-1">
            {freeFeatures.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
            <li className="flex items-center gap-3 text-sm text-slate-400 italic">
              <X className="w-4 h-4 text-slate-300 shrink-0" />
              <span>Auto-Update Notifications</span>
            </li>
          </ul>
          <button 
            onClick={handleFreeClick}
            className="w-full py-3 bg-slate-100 text-slate-800 rounded-xl font-bold mt-8 border border-slate-200 hover:bg-slate-200 transition-colors"
          >
            {session ? "Go to Dashboard" : "Get Started"}
          </button>
        </div>

        {/* Pro Monthly */}
        <div className="bg-white border border-blue-200 rounded-2xl p-8 flex flex-col pricing-card relative">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">PROFESSIONAL</span>
          <h3 className="text-3xl font-bold mt-2 text-slate-800">$12<span className="text-sm font-normal text-slate-500">/mo</span></h3>
          <p className="text-sm text-slate-500 mt-4 leading-relaxed">Full monthly analysis including detailed summaries and alerts.</p>
          <ul className="mt-8 space-y-4 flex-1">
            {proFeaturesMonthly.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-slate-600">
                <Check className="w-4 h-4 text-blue-500 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button 
            onClick={() => handleProClick("monthly")}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mt-8 shadow-lg hover:bg-blue-700 transition-colors"
          >
            Subscribe to Pro
          </button>
        </div>
        
        {/* Pro Annual */}
        <div className="bg-blue-600 rounded-2xl p-8 flex flex-col text-white pricing-card ring-4 ring-blue-100 relative overflow-hidden">
          <div className="absolute top-4 right-4 bg-white text-blue-600 text-[10px] px-2 py-1 rounded-full uppercase font-bold tracking-wider shadow-sm">
            Save 25%
          </div>
          <span className="text-xs font-bold text-blue-200 uppercase tracking-widest">PROFESSIONAL</span>
          <div className="mt-2">
            <h3 className="text-3xl font-bold">$108<span className="text-sm font-normal text-blue-200">/yr</span></h3>
            <p className="text-xs text-blue-100 mt-1">Equivalent to $9/mo</p>
          </div>
          <p className="text-sm text-blue-100 mt-4 leading-relaxed">Best value for long-term protection and all features.</p>
          <ul className="mt-8 space-y-4 flex-1">
            {proFeaturesYearly.map((feature, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <Check className="w-4 h-4 text-blue-200 shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          <button 
            onClick={() => handleProClick("yearly")}
            className="w-full py-3 bg-white text-blue-600 rounded-xl font-bold mt-8 shadow-xl hover:bg-slate-50 transition-colors"
          >
            Subscribe to Pro
          </button>
        </div>
      </div>

      <PaddleCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        planType={selectedPlanType}
        userSession={session}
        onSuccess={() => {
          navigate("/dashboard?tab=preferences");
        }}
      />
    </div>

  );
}

