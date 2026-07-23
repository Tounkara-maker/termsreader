import { initializePaddle, Paddle } from "@paddle/paddle-js";

/**
 * Returns true if the Paddle client token is configured and not using placeholder values.
 */
export function isPaddleConfigured(): boolean {
  const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
  return !!token && token !== "test_xxxxxxxxxxxxxxxxxxxxxxxx" && !token.includes("your-");
}

/**
 * Retrieves the configured client-side Paddle token.
 * Falls back to an empty placeholder to prevent compile crashes.
 */
export function getPaddleToken(): string {
  return import.meta.env.VITE_PADDLE_CLIENT_TOKEN || "";
}

/**
 * Retrieves the Paddle environment. Defaults to sandbox.
 */
export function getPaddleEnvironment(): "sandbox" | "production" {
  const env = import.meta.env.VITE_PADDLE_ENVIRONMENT;
  return env === "production" ? "production" : "sandbox";
}

/**
 * Retrieves the configured Monthly Price ID or a robust default.
 */
export function getMonthlyPriceId(): string {
  return import.meta.env.VITE_PADDLE_PRICE_MONTHLY || "pri_monthly_default_id";
}

/**
 * Retrieves the configured Yearly Price ID or a robust default.
 */
export function getYearlyPriceId(): string {
  return import.meta.env.VITE_PADDLE_PRICE_YEARLY || "pri_yearly_default_id";
}

// Stale closure prevention: route all paddle events to the latest registered callback
let activeEventCallback: ((event: any) => void) | null = null;
let paddlePromise: Promise<Paddle | null> | null = null;

/**
 * Initialises the Paddle.js SDK with event callbacks.
 */
export async function initPaddleInstance(
  eventCallback?: (event: any) => void
): Promise<Paddle | null> {
  if (eventCallback) {
    activeEventCallback = eventCallback;
  }

  if (!isPaddleConfigured()) {
    console.warn("Paddle client token not configured. Skipping initialization.");
    return null;
  }

  if (!paddlePromise) {
    paddlePromise = (async () => {
      try {
        const instance = await initializePaddle({
          token: getPaddleToken(),
          environment: getPaddleEnvironment(),
          eventCallback: (event) => {
            if (activeEventCallback) {
              activeEventCallback(event);
            }
          },
        });
        return instance || null;
      } catch (err) {
        console.error("Failed to initialize Paddle SDK:", err);
        paddlePromise = null; // Allow retry on failure
        return null;
      }
    })();
  }

  return paddlePromise;
}
