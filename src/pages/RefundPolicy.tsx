import { RefreshCw } from "lucide-react";

export default function RefundPolicy() {
  return (
    <div className="max-w-4xl mx-auto py-20 px-6">
      <div className="flex items-center gap-3 mb-8">
        <RefreshCw className="w-10 h-10 text-orange-600" />
        <h1 className="text-4xl font-bold text-slate-900">Refund Policy</h1>
      </div>
      
      <p className="text-xl text-slate-600 mb-10">Last updated: May 13, 2026</p>

      <div className="space-y-10 text-slate-700 leading-relaxed pb-20">
        <section>
          <p className="mb-6">
            <strong>Termsreader</strong> is owned and operated by <strong>VIRAL SARL</strong>. Our payments are processed by <strong>Paddle.com</strong> as our Merchant of Record. This Refund Policy is designed to align with Paddle's buyer protection standards and applicable consumer protection laws.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">1. Our Refund Commitment</h2>
          <p>
            We want you to be satisfied with Termsreader. If you are not satisfied with your purchase, we offer refunds under the conditions outlined in this policy. Paddle, as our Merchant of Record, may also process refund requests under their own Buyer Terms in certain situations.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">2. Free Trial</h2>
          <p>
            All new Termsreader accounts receive a 7-day free trial. You will not be charged during this period. If you cancel before the trial period ends, you will not be charged. We encourage you to evaluate Termsreader during this period before your subscription begins.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">3. Eligibility for Refunds</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800">3.1 Refunds We Offer</h3>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Within 14 days of initial subscription purchase:</strong> You may request a full refund of your first payment within 14 days of your initial subscription charge (after the free trial), no questions asked.</li>
                <li><strong>Accidental duplicate charges:</strong> If you were charged twice for the same subscription period, we will refund the duplicate charge promptly.</li>
                <li><strong>Technical failure:</strong> If a significant technical issue on our end prevented you from using the service for a prolonged period (more than 72 consecutive hours) and we were unable to resolve it, you may be eligible for a pro-rated refund for that period.</li>
                <li><strong>Unauthorized charges:</strong> If a charge was made without your authorization, contact us immediately. We will investigate and, if confirmed, issue a full refund.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">3.2 Refunds We Do Not Offer</h3>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Refunds for subscription renewals where you forgot to cancel before the renewal date, unless you contact us within 48 hours of the charge.</li>
                <li>Refunds for partial months or years after the 14-day initial refund window has passed.</li>
                <li>Refunds for accounts that have violated our Terms of Service.</li>
                <li>Refunds based on dissatisfaction with AI summary accuracy alone (we encourage use of the free trial to evaluate this).</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">4. How to Request a Refund</h2>
          <p className="mb-4">To request a refund, contact us at <strong>billing@termsreader.site</strong> with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your account email address</li>
            <li>The date and amount of the charge</li>
            <li>The reason for your refund request</li>
          </ul>
          <p className="mt-4">We will respond within 2 business days. Approved refunds are typically processed within 5–10 business days, depending on your payment method and bank.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">5. Paddle Buyer Protections</h2>
          <p>
            Because Paddle.com is our Merchant of Record, you may also contact Paddle directly to raise a billing dispute or request a refund under Paddle's Buyer Terms. Paddle may, at their discretion, offer refunds in accordance with their own policies and applicable consumer protection laws in your jurisdiction.
          </p>
          <p className="mt-2 text-sm font-medium">Paddle's buyer support: <a href="https://paddle.com/legal/buyer-terms" className="text-blue-600 hover:underline">paddle.com/legal/buyer-terms</a></p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">6. Chargebacks</h2>
          <p>
            We encourage you to contact us before initiating a chargeback with your bank. Chargebacks are costly and time-consuming for both parties. If you contact us directly, we can typically resolve billing issues faster than the chargeback process. Accounts with disputed chargebacks may be suspended pending resolution.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">7. Subscription Cancellation</h2>
          <p>
            Cancelling your subscription stops future charges. Cancellation does not automatically trigger a refund for the current billing period. You retain access to Termsreader until the end of your paid period. To cancel, go to your Dashboard → Billing.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">8. Changes to This Policy</h2>
          <p>
            We may update this Refund Policy from time to time. Changes will be announced at least 14 days in advance on our website and by email.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">9. Contact</h2>
          <p>
            For all billing and refund inquiries:<br/>
            VIRAL SARL — Termsreader Billing Support<br/>
            <strong>billing@termsreader.site</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
