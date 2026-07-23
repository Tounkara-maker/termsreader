import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto py-20 px-6">
      <div className="flex items-center gap-3 mb-8">
        <ShieldCheck className="w-10 h-10 text-blue-600" />
        <h1 className="text-4xl font-bold text-slate-900">Terms of Service</h1>
      </div>
      
      <p className="text-xl text-slate-600 mb-10">Last updated: May 13, 2026</p>

      <div className="space-y-10 text-slate-700 leading-relaxed pb-20">
        <section>
          <p className="mb-6">
            <strong>Termsreader</strong> is owned and operated by <strong>VIRAL SARL</strong>. By using the Termsreader website and Chrome extension, you agree to these Terms of Service. Please read them carefully.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">1. About Termsreader and VIRAL SARL</h2>
          <p>
            Termsreader ("the Service") is a software product owned and operated by VIRAL SARL ("Company," "we," "us," or "our"). VIRAL SARL provides the Termsreader Chrome extension and supporting website to help users understand the privacy policies and terms of service of websites they visit.
          </p>
          <p className="mt-4">
            Our payment processing and subscription billing is handled by <strong>Paddle.com</strong> as our Merchant of Record.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">2. Acceptance of Terms</h2>
          <p>
            By creating an account, installing the extension, or accessing the Service, you confirm that you are at least 16 years old, have the legal capacity to enter into this agreement, and agree to be bound by these Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">3. The Service</h2>
          <p>
            Termsreader provides an AI-powered Chrome extension that detects, reads, and summarizes terms pages (privacy policies, terms of service, refund policies, and similar legal documents) on websites you visit, then displays a color-coded summary in a sidebar within your browser.
          </p>
          
          <div className="mt-4 space-y-4">
            <h3 className="font-bold text-slate-800">3.1 What We Do Not Provide</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Legal advice.</strong> Termsreader summaries are for informational purposes only and do not constitute legal counsel.</li>
              <li><strong>Guarantee of completeness.</strong> AI summarization may not capture every nuance of a legal document.</li>
              <li><strong>Guarantee of accuracy.</strong> Terms pages change frequently; cached summaries may occasionally be out of date.</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">4. User Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account. You are responsible for all activity that occurs under your account.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">5. Subscriptions and Billing</h2>
          <p>
            Access to the full functionality of Termsreader requires a paid subscription. Subscriptions are processed and managed by <strong>Paddle.com</strong> on behalf of VIRAL SARL.
          </p>
          <ul className="list-disc pl-6 mt-4 space-y-2">
            <li><strong>Free Trial:</strong> New accounts receive a 7-day free trial. A valid payment method is required. You will not be charged until the trial ends unless you cancel before the trial period expires.</li>
            <li><strong>Automatic Renewal:</strong> Subscriptions automatically renew at the end of each billing period (monthly or annually) unless cancelled before the renewal date.</li>
            <li><strong>Price Changes:</strong> We reserve the right to change subscription prices. We will give you at least 30 days' notice before any price increase takes effect.</li>
            <li><strong>Cancellation:</strong> You may cancel at any time from your dashboard. You retain access until the end of your paid billing period.</li>
          </ul>
          <p className="mt-4">For refunds, please see our <Link to="/refund" className="text-blue-600 hover:underline">Refund Policy</Link>.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">6. Acceptable Use</h2>
          <p className="mb-4">You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Attempt to reverse-engineer, decompile, or circumvent the Service.</li>
            <li>Use the Service to collect data about third-party websites in bulk for commercial data resale.</li>
            <li>Share your account credentials with others.</li>
            <li>Use automated tools to artificially inflate usage or bypass subscription limits.</li>
            <li>Use the Service in any way that violates applicable laws or regulations.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">7. Intellectual Property</h2>
          <p>
            All content, software, trademarks, and intellectual property associated with Termsreader — including the brand name, logo, extension code, website, and AI prompts — are owned by <strong>VIRAL SARL</strong>. You are granted a limited, non-exclusive, non-transferable license to use the Service for your personal, non-commercial use.
          </p>
          <p className="mt-4">
            You retain ownership of any data you provide (such as your preferences). You grant VIRAL SARL a limited license to use that data to provide the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">8. Disclaimer of Warranties</h2>
          <p className="uppercase text-sm font-bold tracking-tight bg-slate-50 p-4 rounded-lg">
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY ACCURATE.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">9. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, VIRAL SARL SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE, INCLUDING BUT NOT LIMITED TO RELIANCE ON AN AI-GENERATED SUMMARY OF LEGAL DOCUMENTS. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">10. Indemnification</h2>
          <p>
            You agree to indemnify and hold harmless VIRAL SARL and its officers, employees, and agents from any claims, damages, or expenses arising from your violation of these Terms or your misuse of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">11. Governing Law</h2>
          <p>
            These Terms are governed by the laws applicable to VIRAL SARL's jurisdiction of incorporation, without regard to conflict-of-law principles. Any disputes shall be resolved in the courts of competent jurisdiction in that territory.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">12. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. We will notify you by email and display an in-app notice at least 14 days before material changes take effect. Continued use of the Service after changes constitute acceptance of the new Terms.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">13. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account if you violate these Terms, with or without notice. You may also delete your account at any time from your dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-slate-900">14. Contact</h2>
          <p>
            VIRAL SARL — Termsreader Legal Team<br/>
            <strong>legal@termsreader.site</strong>
          </p>
        </section>
      </div>
    </div>
  );
}
