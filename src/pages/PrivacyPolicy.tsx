import { Shield } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto py-20 px-6">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-10 h-10 text-green-600" />
        <h1 className="text-4xl font-bold text-slate-900">Privacy Policy</h1>
      </div>
      
      <p className="text-xl text-slate-600 mb-10">Last updated: May 13, 2026</p>

      <div className="space-y-10 text-slate-700 leading-relaxed pb-20">
        <section>
          <p className="mb-6">
            Termsreader is owned and operated by <strong>VIRAL SARL</strong>. We are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use the Termsreader Chrome extension and website.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">1. Who We Are</h2>
          <p>
            Termsreader is a product of VIRAL SARL, a company registered in accordance with applicable laws. References to "Termsreader," "we," "us," or "our" in this policy refer to VIRAL SARL.
          </p>
          <p className="mt-2 font-medium">Contact: privacy@termsreader.site</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">2. Information We Collect</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-slate-800">2.1 Information You Provide</h3>
              <p>Account information: Full name, email address, and password when you create an account.</p>
              <p>Preferences: Your selections of privacy policy and terms elements during onboarding.</p>
              <p>Payment information: Processed entirely by Paddle.com. We do not store payment card details.</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">2.2 Information Collected Automatically</h3>
              <p>Browsing context: When you visit a website with the extension active, the URLs of terms pages on that site are sent to our servers for analysis. We do not collect your general browsing history.</p>
              <p>Usage data: Which websites you've had analyzed, timestamps of visits, and whether analysis results were shown.</p>
              <p>Device and technical data: Browser type, extension version, and general geographic region (country level).</p>
            </div>
            <div>
              <h3 className="font-bold text-slate-800">2.3 Terms Page Content</h3>
              <p>When you visit a website, the Termsreader extension extracts the text content of detected terms pages (privacy policies, terms of service, etc.) from that website. This content is sent to our servers, processed by AI (Gemini) to generate a summary, then cached. We store the processed summary — not the full raw text of third-party terms pages — after processing.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide the Termsreader service: analyzing terms pages and generating personalized color-coded summaries.</li>
            <li>To compare terms page content against your stated preferences (accepted/declined elements).</li>
            <li>To detect updates to terms pages you've previously visited.</li>
            <li>To manage your subscription and communicate about billing.</li>
            <li>To improve the accuracy and performance of our summarization service.</li>
            <li>To send service-related emails (account confirmation, billing receipts, important updates).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">4. Data Sharing</h2>
          <p className="mb-4">We share your data only in the following limited circumstances:</p>
          <ul className="list-disc pl-6 space-y-4">
            <li><strong>Google Gemini:</strong> Terms page text content is sent to Google's Gemini API to generate summaries. Gemini processes this data under their API privacy terms and does not train on API data by default.</li>
            <li><strong>Paddle.com:</strong> Our Merchant of Record for payment processing. Paddle receives your email and payment details to process subscriptions.</li>
            <li><strong>Supabase:</strong> Our database provider. Your account data and preferences are stored on Supabase-hosted infrastructure.</li>
            <li><strong>Legal requirements:</strong> If required by law, court order, or government authority.</li>
          </ul>
          <p className="mt-4 font-bold">We do not sell your personal data. We do not share your data with advertisers.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">5. Data Retention</h2>
          <p>We retain your account data for as long as your account is active. Cached terms summaries are retained indefinitely to serve future users visiting the same page. If you delete your account, your personal preferences, visit history, and analysis results are deleted within 30 days. Anonymized cached summaries may remain.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">6. Your Rights</h2>
          <p className="mb-4">Depending on your jurisdiction, you may have the following rights:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Access: Request a copy of your personal data.</li>
            <li>Correction: Update inaccurate data via your dashboard.</li>
            <li>Deletion: Request deletion of your account and personal data.</li>
            <li>Portability: Request your data in a machine-readable format.</li>
            <li>Opt-out: You can stop using the service and delete your account at any time.</li>
          </ul>
          <p className="mt-4">To exercise your rights, contact us at <strong>privacy@termsreader.site</strong>.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">7. Cookies</h2>
          <p>Our website uses session cookies for authentication (managed by Supabase Auth). We do not use advertising cookies or third-party tracking cookies. The Chrome extension does not set cookies.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">8. Security</h2>
          <p>We implement industry-standard security measures including encrypted database storage (Supabase), HTTPS for all data in transit, API key isolation (keys are never exposed to the extension), and row-level security on all user data. However, no system is perfectly secure, and we cannot guarantee absolute security.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">9. Children's Privacy</h2>
          <p>Termsreader is not directed at children under 16. We do not knowingly collect data from children under 16. If you believe we have inadvertently collected such data, contact us immediately.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">10. International Transfers</h2>
          <p>Your data may be processed in countries outside your own, including the United States (Google, Supabase) and the EU (Paddle). We take appropriate steps to ensure such transfers comply with applicable data protection laws.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">11. Changes to This Policy</h2>
          <p>We will notify you via email and an in-app notice at least 14 days before making material changes to this policy. Continued use of the service after changes take effect constitutes acceptance.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">12. Contact</h2>
          <p>
            VIRAL SARL — Termsreader Privacy Team<br/>
            <strong>privacy@termsreader.site</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
