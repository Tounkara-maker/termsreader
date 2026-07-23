import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Crown, Settings, CheckCircle2, ChevronRight, HelpCircle, Loader2, CreditCard } from "lucide-react";
import { 
  isPaddleConfigured, 
  getPaddleToken, 
  getPaddleEnvironment,
  getMonthlyPriceId,
  getYearlyPriceId,
  initPaddleInstance
} from "../lib/paddle";

interface PaddleCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  planType: "monthly" | "yearly";
  userSession: any;
  onSuccess: () => void;
}

export default function PaddleCheckoutModal({
  isOpen,
  onClose,
  planType,
  userSession,
  onSuccess
}: PaddleCheckoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const planTypeRef = useRef(planType);
  useEffect(() => {
    planTypeRef.current = planType;
  }, [planType]);

  // Trigger Paddle SDK checkout if configured
  const triggerRealCheckout = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const activePlanType = planTypeRef.current;
      const priceId = activePlanType === "monthly" ? getMonthlyPriceId() : getYearlyPriceId();
      const paddle = await initPaddleInstance((event) => {
        if (event.name === "checkout.completed") {
          console.log("Paddle Sandbox Checkout Success Event Received!", event);
          const subscriptionId = event.data?.subscription?.id || 
                                 event.data?.subscription_id || 
                                 (event.data?.items && event.data.items[0]?.subscription_id) || 
                                 "sub_sandbox_completed";
          const customerId = event.data?.customer?.id || 
                             event.data?.customer_id || 
                             "ctm_sandbox_completed";
          handleUpgradeSuccess(subscriptionId, customerId);
        }
      });

      if (paddle) {
        setLoading(false);
        paddle.Checkout.open({
          items: [
            {
              priceId: priceId,
              quantity: 1
            }
          ],
          customData: {
            userId: userSession?.user?.id,
            billingCycle: activePlanType
          },
          settings: {
            displayMode: "overlay",
            theme: "light",
            locale: "en"
          },
          customer: {
            email: userSession?.user?.email
          }
        });
      } else {
        throw new Error("Could not initialize Paddle SDK instance.");
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || "Failed to trigger Paddle Checkout. Please check your token or try simulating below.");
      setLoading(false);
    }
  };

  const handleUpgradeSuccess = async (subscriptionId?: string, customerId?: string) => {
    setSimulating(true);
    try {
      const activePlanType = planTypeRef.current;
      const res = await fetch("/api/profile/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userSession?.access_token}`
        },
        body: JSON.stringify({ 
          planType: activePlanType,
          subscriptionId: subscriptionId || `sub_sim_${Math.random().toString(36).substring(2, 10)}`,
          customerId: customerId || `ctm_sim_${Math.random().toString(36).substring(2, 10)}`
        })
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setErrorMessage(data.error || "Failed to persist upgrade on server");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error occurred during plan upgrade.");
    } finally {
      setSimulating(false);
    }
  };

  useEffect(() => {
    if (isOpen && isPaddleConfigured()) {
      triggerRealCheckout();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const configured = isPaddleConfigured();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
        />

        {/* Modal Box */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-lg w-full border border-slate-200"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-base leading-tight">Paddle Sandbox Portal</h3>
                <p className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 mt-0.5">Secure Sandbox checkout</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-8">
            {configured ? (
              <div className="text-center py-6">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                <h4 className="text-lg font-bold text-slate-800">Opening Paddle Checkout...</h4>
                <p className="text-sm text-slate-500 mt-2">
                  We are initializing Paddle Checkout Overlay for your <strong>{planType}</strong> Pro plan.
                </p>
                {errorMessage && (
                  <div className="mt-4 p-4 bg-red-50 text-red-700 text-xs rounded-xl font-medium border border-red-100">
                    {errorMessage}
                  </div>
                )}
                <button
                  onClick={triggerRealCheckout}
                  className="mt-6 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold text-xs rounded-xl transition-all"
                >
                  Retry Load Checkout
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full mb-3">
                    <Settings className="w-3.5 h-3.5" />
                    Pending Developer Config
                  </div>
                  <h4 className="text-xl font-black text-slate-900 tracking-tight">Setup Paddle Billing Sandbox</h4>
                  <p className="text-slate-500 text-xs leading-relaxed font-semibold mt-1.5">
                    Your environment variables currently do not contain verified credentials. Follow these simple steps to hook your Paddle accounts up:
                  </p>
                </div>

                {/* Instructions Grid */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100/80">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black shrink-0 flex items-center justify-center mt-0.5">1</span>
                    <div className="text-xs">
                      <p className="font-bold text-slate-700">Add client side key</p>
                      <p className="text-slate-400 font-medium mt-0.5 leading-normal">
                        Retrieve client-side token from Paddle Sandbox dashboard and set equal to <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px]">VITE_PADDLE_CLIENT_TOKEN</code>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100/80">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black shrink-0 flex items-center justify-center mt-0.5">2</span>
                    <div className="text-xs">
                      <p className="font-bold text-slate-700">Add price IDs</p>
                      <p className="text-slate-400 font-medium mt-0.5 leading-normal">
                        Create Sandbox monthly/yearly products. Fill values into <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px]">VITE_PADDLE_PRICE_MONTHLY</code> and <code className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded text-[10px]">VITE_PADDLE_PRICE_YEARLY</code>.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Success Simulation Action */}
                <div className="bg-indigo-50/60 p-5 rounded-2xl border border-indigo-100 mt-4 text-center">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-indigo-600 inline-block mb-1">Instant Sandbox Testing</span>
                  <p className="text-slate-600 text-xs font-semibold leading-relaxed mb-4 px-2">
                    Click below to trigger a simulated successful purchase and immediately transition your account profile to the high-tier <strong>{planType} Pro</strong> plan!
                  </p>

                  <button
                    onClick={() => handleUpgradeSuccess(`sub_sim_${Math.random().toString(36).substring(2, 10)}`)}
                    disabled={simulating}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {simulating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Finishing upgrade...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Simulate Sandbox Purchase
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
