import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, paddle-signature",
}

// Convert Hex string (h1) to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Verify Paddle Webhook Signature Natively using Web Crypto API
async function verifyPaddleSignature(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!signatureHeader || !secret) return false;
  try {
    const parts = signatureHeader.split(";").reduce((acc: Record<string, string>, part) => {
      const [key, val] = part.split("=");
      if (key && val) acc[key] = val;
      return acc;
    }, {});

    const ts = parts.ts;
    const h1 = parts.h1;

    if (!ts || !h1) return false;

    const signedPayload = `${ts}:${rawBody}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = hexToBytes(h1);
    const payloadBytes = encoder.encode(signedPayload);

    return await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      payloadBytes
    );
  } catch (err) {
    console.error("[Paddle Signature Verification Exception]", err);
    return false;
  }
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

// Webhook billing cycle detection has been completely disabled to prevent overwriting
// the accurate billing cycle set by the direct manual API upgrade route.

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const signatureHeader = req.headers.get("paddle-signature") || "";
    const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET") || "";

    const rawBody = await req.text();

    // Verify webhook signature if secret is configured in Supabase Edge Function environment
    if (webhookSecret && webhookSecret !== "your-webhook-secret") {
      const isValid = await verifyPaddleSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        console.error("[Paddle Webhook] Invalid signature verification.");
        return new Response(JSON.stringify({ error: "Invalid Paddle webhook signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      console.log("[Paddle Webhook] Signature verified successfully.");
    } else {
      console.log("[Paddle Webhook] Bypass signature verification because PADDLE_WEBHOOK_SECRET is not configured.");
    }

    const payload = JSON.parse(rawBody);
    const eventType = payload?.event_type;
    const eventData = payload?.data;

    if (!eventType || !eventData) {
      return new Response(JSON.stringify({ success: true, message: "Unhandled payload format" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[Paddle Webhook] Processing '${eventType}' event ID: ${eventData.id}`);

    // Extract subscription metadata
    const customerId = eventData.customer_id || eventData.customer?.id;
    const subscriptionId = eventData.subscription_id || (eventType.startsWith("subscription.") ? eventData.id : null);
    const planStatus = eventData.status;

    const startsAt = eventData.current_billing_period?.starts_at || eventData.started_at;
    const endsAt = eventData.current_billing_period?.ends_at || eventData.next_billed_at;

    const customData = eventData.custom_data || 
                     eventData.subscription?.custom_data || 
                     eventData.transaction?.custom_data || 
                     {};
    let targetUserId = customData.userId || customData.user_id;

    // Connect to Supabase using Admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // 1. Try to find user by paddle_subscription_id if targetUserId is missing
    if (!targetUserId && subscriptionId) {
      console.log(`[Paddle Webhook] No userId, searching profile table by paddle_subscription_id: ${subscriptionId}`);
      try {
        const { data: profiles, error: findErr } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("paddle_subscription_id", subscriptionId);
        if (!findErr && profiles && profiles.length > 0) {
          targetUserId = profiles[0].id;
          console.log(`[Paddle Webhook Success] Found local user ID by subscription ID: ${targetUserId}`);
        }
      } catch (findEx) {
        console.error("[Paddle Webhook] Error finding profile by subscription ID:", findEx);
      }
    }

    // 2. Try to find user by paddle_customer_id if targetUserId is still missing
    if (!targetUserId && customerId) {
      console.log(`[Paddle Webhook] No userId, searching profile table by paddle_customer_id: ${customerId}`);
      try {
        const { data: profiles, error: findErr } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("paddle_customer_id", customerId);
        if (!findErr && profiles && profiles.length > 0) {
          targetUserId = profiles[0].id;
          console.log(`[Paddle Webhook Success] Found local user ID by customer ID: ${targetUserId}`);
        }
      } catch (findEx) {
        console.error("[Paddle Webhook] Error finding profile by customer ID:", findEx);
      }
    }

    // 3. Email fallback if customData has no userId and we couldn't resolve by IDs
    if (!targetUserId) {
      const customerEmail = eventData.customer?.email || eventData.customer_email;
      if (customerEmail) {
        console.log(`[Paddle Webhook] No userId, searching profile table by email: ${customerEmail}`);
        const { data: profiles, error: findErr } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", customerEmail);

        if (!findErr && profiles && profiles.length > 0) {
          targetUserId = profiles[0].id;
        } else {
          // Direct auth users fallback check
          const { data: { users }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
          if (!authErr && users) {
            const matchedUser = users.find((u) => u.email?.toLowerCase() === customerEmail.toLowerCase());
            if (matchedUser) {
              targetUserId = matchedUser.id;
            }
          }
        }
      }
    }

    if (!targetUserId) {
      console.warn(`[Paddle Webhook Warning] No corresponding local user found. Skipping DB updates.`);
      return new Response(JSON.stringify({ success: true, message: "No matching user found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Process upgrade / update / cancel events
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
        const { data: p, error: selectErr } = await supabaseAdmin.from("profiles").select("*").eq("id", targetUserId).single();
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
        const apiKey = Deno.env.get("PADDLE_API_KEY") || "";
        // Detect the correct billing cycle from the webhook payload itself or by fetching from Paddle
        let detectedBillingCycle = null;

        // 1. Fetch directly from Paddle API (100% accurate)
        if (apiKey && subscriptionId && subscriptionId !== "sub_sandbox_completed" && !subscriptionId.startsWith("sub_sim_")) {
          try {
            let paddleEnv = Deno.env.get("VITE_PADDLE_ENVIRONMENT") || "sandbox";
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
          const yearlyId = Deno.env.get("VITE_PADDLE_PRICE_YEARLY") || "pri_yearly_default_id";
          const monthlyId = Deno.env.get("VITE_PADDLE_PRICE_MONTHLY") || "pri_monthly_default_id";
          
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

        console.log(`[Paddle Webhook Debug] Detected billing cycle: ${detectedBillingCycle}`);

        const updateFields: any = {
          plan: isCanceled ? "free" : `pro-${detectedBillingCycle}`,
          billing_cycle: isCanceled ? null : detectedBillingCycle,
          paddle_subscription_id: isCanceled ? null : subscriptionId,
          paddle_customer_id: customerId,
          cancel_at_period_end: isCanceled ? false : (hasScheduledCancellation ? true : false)
        };

        if (startsAt && !isCanceled) updateFields.subscription_start = startsAt;
        if (endsAt && !isCanceled) updateFields.subscription_end = endsAt;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update(updateFields)
          .eq("id", targetUserId);

        if (error) {
          console.error(`[Paddle Webhook DB Update Error] Code: ${error.code} | Message: ${error.message}`);
          // Fallback to standard simple columns if newer columns don't exist yet in target database
          if (error.code === "42703" || error.code === "PGRST204") {
            console.log("[Paddle Webhook DB Fallback] Standard column mapping failed, using basic mapping...");
            
            let fallbackPlan = "pro";
            if (isCanceled) {
              fallbackPlan = "free";
            } else {
              fallbackPlan = `pro-${detectedBillingCycle}`;
            }

            await supabaseAdmin
              .from("profiles")
              .update({
                plan: fallbackPlan,
                billing_cycle: isCanceled ? null : detectedBillingCycle,
                paddle_subscription_id: isCanceled ? null : subscriptionId
              })
              .eq("id", targetUserId);
          } else {
            throw error;
          }
        }
        console.log(`[Paddle Webhook DB Update Success] Handled user profile ${targetUserId} successfully with billing cycle: ${detectedBillingCycle}`);
      } catch (dbErr: any) {
        console.error("[Paddle Webhook DB Exception]", dbErr);
      }
    }

    return new Response(JSON.stringify({ success: true, processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[Paddle Webhook Edge Function Error]", err);
    return new Response(JSON.stringify({ error: "Internal Webhook Error", details: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
})