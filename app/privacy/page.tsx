import { Metadata } from "next"
import { Lock, Eye, Trash2, Download, Mail } from "lucide-react"
import { PublicHeader } from "@/components/public-header"
import { LandingFooter } from "@/components/landing/landing-footer"

export const metadata: Metadata = {
  title: "Privacy Policy | Clarus",
  description: "Privacy Policy for Clarus — how we collect, use, and protect your data. GDPR and CCPA compliant. No data selling, no ad tracking.",
  openGraph: {
    title: "Privacy Policy | Clarus",
    description: "How Clarus collects, uses, and protects your data. GDPR and CCPA compliant.",
    url: "https://clarusapp.io/privacy",
    type: "website",
  },
  alternates: {
    canonical: "https://clarusapp.io/privacy",
  },
}

// ISR: revalidate every 24 hours — legal content changes very rarely
export const revalidate = 86400

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <PublicHeader />

      {/* Content */}
      <main id="main-content" className="flex-1 max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-brand to-brand-hover rounded-xl flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
            <p className="text-white/50 text-sm">Last updated: January 29, 2026</p>
          </div>
        </div>

        {/* Your Rights Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Eye className="w-5 h-5 text-brand mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Right to Access</h3>
            <p className="text-white/50 text-xs">Request a copy of your data</p>
          </div>
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Trash2 className="w-5 h-5 text-brand mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Right to Deletion</h3>
            <p className="text-white/50 text-xs">Request deletion of your data</p>
          </div>
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Download className="w-5 h-5 text-brand mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Data Portability</h3>
            <p className="text-white/50 text-xs">Export your data anytime</p>
          </div>
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Mail className="w-5 h-5 text-brand mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Contact Us</h3>
            <p className="text-white/50 text-xs">privacy@clarusapp.io</p>
          </div>
        </div>

        {/* Privacy Content */}
        <div className="prose prose-invert max-w-none">
          <div className="space-y-8 text-white/70">
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
              <p className="leading-relaxed">
                InfoSecOps LLC (&quot;Clarus,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Clarus service (&quot;the Service&quot;). We are committed to compliance with applicable data protection laws, including the General Data Protection Regulation (GDPR), the California Consumer Privacy Act (CCPA), and other applicable privacy regulations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">2. Data We Collect</h2>
              <p className="leading-relaxed mb-3">
                We collect only the data necessary to provide and improve the Service:
              </p>

              <h3 className="text-lg font-medium text-white mb-2 mt-4">2.1 Information You Provide</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Account Information:</strong> Email address, display name, and authentication credentials when you create an account</li>
                <li><strong className="text-white">Content URLs:</strong> URLs you submit for analysis (articles, YouTube videos, social media posts, PDF documents)</li>
                <li><strong className="text-white">Chat Messages:</strong> Messages you send in the per-content chat feature to discuss analyses</li>
                <li><strong className="text-white">Tags and Notes:</strong> Tags you apply to organize your content</li>
                <li><strong className="text-white">Payment Information:</strong> Billing details processed by our payment provider (we do not store credit card numbers)</li>
              </ul>

              <h3 className="text-lg font-medium text-white mb-2 mt-4">2.2 Automatically Collected Information</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Usage Data:</strong> Features used, analysis history, and interaction patterns (for improving the Service)</li>
                <li><strong className="text-white">Device Information:</strong> Browser type, operating system, and device type (for compatibility)</li>
                <li><strong className="text-white">Log Data:</strong> IP address, access times, and referring URLs (for security and abuse prevention)</li>
              </ul>

              <h3 className="text-lg font-medium text-white mb-2 mt-4">2.3 What We Do NOT Collect</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Browsing history outside of our Service</li>
                <li>Social media activity or contacts</li>
                <li>Location data (beyond IP-based country for legal compliance)</li>
                <li>Biometric data</li>
                <li>Data from third-party data brokers</li>
                <li>Data for advertising or marketing profiling purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Data</h2>
              <p className="leading-relaxed mb-3">
                We use your data for the following purposes and no others:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Provide the Service:</strong> Process your content for AI analysis, store your analysis history, and enable features like chat, bookmarks, and exports</li>
                <li><strong className="text-white">Authentication and Security:</strong> Verify your identity, protect your account, and prevent abuse</li>
                <li><strong className="text-white">Service Improvement:</strong> Understand usage patterns to improve features, fix bugs, and optimize performance</li>
                <li><strong className="text-white">Communication:</strong> Send you transactional emails (analysis complete notifications, password resets, account updates) and optional digest emails (which you can disable at any time)</li>
                <li><strong className="text-white">Legal Compliance:</strong> Comply with applicable laws, regulations, and legal processes</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong className="text-white">We do NOT:</strong> Sell your personal data, use it for advertising, share it with data brokers, or use it to build marketing profiles.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">4. AI Processing and Your Content</h2>
              <p className="leading-relaxed mb-3">
                When you submit content for analysis, it is processed by third-party AI models to generate summaries, assessments, and insights. You should understand the following:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Submitted content (article text, video transcripts) is sent to AI providers for processing</li>
                <li>AI providers may process your content on servers in the United States or other countries</li>
                <li>We do not use your submitted content to train AI models</li>
                <li>AI-generated analysis results are stored in your account and are only accessible to you (and anyone you share a link with)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">5. Cookie Policy</h2>
              <p className="leading-relaxed mb-3">
                We use only essential cookies required for the Service to function:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Authentication Cookies:</strong> To keep you logged in securely (Supabase auth tokens)</li>
                <li><strong className="text-white">Preference Cookies:</strong> To remember your UI settings (stored locally in your browser, not on our servers)</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong className="text-white">We do NOT use:</strong> Analytics cookies, advertising cookies, social media tracking cookies, or any third-party tracking technology. We do not use Google Analytics, Facebook Pixel, or similar services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. Data Sharing and Disclosure</h2>
              <p className="leading-relaxed mb-3">
                We share your data only in the following limited circumstances:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Service Providers:</strong> We use third-party services to operate the Service (see Section 7). These providers process data on our behalf and are contractually obligated to protect your information</li>
                <li><strong className="text-white">Shareable Links:</strong> If you generate a shareable link for an analysis, anyone with that link can view the analysis in read-only mode. No personal information about you is included in shared analyses</li>
                <li><strong className="text-white">Legal Requirements:</strong> We may disclose your information if required by law, subpoena, court order, or governmental regulation, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others</li>
                <li><strong className="text-white">Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your data may be transferred as part of that transaction. We will notify you of any such change</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong className="text-white">We never sell, rent, or trade your personal data to third parties for their marketing purposes.</strong>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">7. Third-Party Services</h2>
              <p className="leading-relaxed mb-3">
                We use the following third-party services to provide the Service. Each processes data on our behalf:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Supabase:</strong> Database, authentication, and data storage (PostgreSQL hosting)</li>
                <li><strong className="text-white">Vercel:</strong> Application hosting and content delivery</li>
                <li><strong className="text-white">OpenRouter:</strong> AI model access for content analysis (processes submitted content text)</li>
                <li><strong className="text-white">Firecrawl:</strong> Web scraping for article content extraction</li>
                <li><strong className="text-white">Supadata:</strong> YouTube transcript extraction</li>
                <li><strong className="text-white">Tavily:</strong> Web search for contextual information during analysis</li>
                <li><strong className="text-white">Resend:</strong> Transactional email delivery</li>
                <li><strong className="text-white">Polar:</strong> Payment processing and subscription management</li>
                <li><strong className="text-white">Sentry:</strong> Error monitoring and performance tracking (processes error reports and page performance data)</li>
                <li><strong className="text-white">Deepgram:</strong> Audio transcription for podcast analysis (processes podcast audio for speaker-identified transcripts)</li>
              </ul>
              <p className="leading-relaxed mt-4">
                Each of these services maintains their own privacy policies. We select providers that maintain appropriate data protection standards.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">8. Your Rights</h2>
              <p className="leading-relaxed mb-3">
                Depending on your jurisdiction, you may have the following rights regarding your personal data:
              </p>

              <h3 className="text-lg font-medium text-white mb-2 mt-4">For All Users:</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Access:</strong> Request a copy of your personal data we hold</li>
                <li><strong className="text-white">Correction:</strong> Request correction of inaccurate personal data</li>
                <li><strong className="text-white">Deletion:</strong> Request deletion of your personal data and account</li>
                <li><strong className="text-white">Export:</strong> Receive your data in a portable, machine-readable format</li>
                <li><strong className="text-white">Opt-Out:</strong> Unsubscribe from optional emails (digest, notifications) at any time</li>
              </ul>

              <h3 className="text-lg font-medium text-white mb-2 mt-4">Additional Rights for EU/EEA Residents (GDPR):</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Right to Object:</strong> Object to processing based on legitimate interests</li>
                <li><strong className="text-white">Right to Restrict Processing:</strong> Request limitation of processing in certain circumstances</li>
                <li><strong className="text-white">Right to Lodge a Complaint:</strong> File a complaint with your local data protection supervisory authority</li>
              </ul>

              <h3 className="text-lg font-medium text-white mb-2 mt-4">Additional Rights for California Residents (CCPA):</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Right to Know:</strong> Request disclosure of the categories and specific pieces of personal data collected</li>
                <li><strong className="text-white">Right to Delete:</strong> Request deletion of personal data collected</li>
                <li><strong className="text-white">Right to Non-Discrimination:</strong> We will not discriminate against you for exercising your privacy rights</li>
                <li><strong className="text-white">No Sale of Data:</strong> We do not sell personal data as defined under the CCPA</li>
              </ul>

              <p className="leading-relaxed mt-4">
                To exercise any of these rights, contact us at{" "}
                <a href="mailto:privacy@clarusapp.io" className="text-brand hover:underline">
                  privacy@clarusapp.io
                </a>. We will respond to your request within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">9. Data Retention</h2>
              <p className="leading-relaxed mb-3">
                We retain your data as follows:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Account Data:</strong> Retained for as long as your account is active</li>
                <li><strong className="text-white">Analysis History:</strong> Retained for as long as your account is active</li>
                <li><strong className="text-white">Log Data:</strong> Retained for up to 90 days for security purposes</li>
                <li><strong className="text-white">After Account Deletion:</strong> We will delete or anonymize your personal data within 30 days of account deletion, unless we are required by law to retain certain information longer</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">10. Data Security</h2>
              <p className="leading-relaxed">
                We implement appropriate technical and organizational measures to protect your personal data, including: encryption of data in transit (TLS/HTTPS) and at rest, secure authentication mechanisms, row-level security at the database level, rate limiting and abuse prevention, and regular security assessments. However, no method of electronic storage or transmission is 100% secure, and we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">11. International Data Transfers</h2>
              <p className="leading-relaxed">
                Your data may be transferred to and processed in the United States or other countries where our service providers operate. When we transfer data internationally, we ensure appropriate safeguards are in place, including Standard Contractual Clauses approved by the European Commission where applicable.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">12. Children&apos;s Privacy</h2>
              <p className="leading-relaxed">
                The Service is not intended for children under 16 years of age. We do not knowingly collect personal data from children under 16. If you become aware that a child under 16 has provided us with personal data, please contact us immediately and we will take steps to delete such information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">13. Changes to This Policy</h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the updated policy on this page and updating the &quot;Last updated&quot; date. For significant changes, we may also send you an email notification. Your continued use of the Service after changes are posted constitutes your acceptance of the revised Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">14. Contact Us</h2>
              <p className="leading-relaxed mb-3">
                If you have questions about this Privacy Policy or wish to exercise your data protection rights:
              </p>
              <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl mt-4">
                <p className="text-white/70 mb-1">
                  <strong className="text-white">InfoSecOps LLC</strong>
                </p>
                <p className="text-white/70">
                  Privacy inquiries:{" "}
                  <a href="mailto:privacy@clarusapp.io" className="text-brand hover:underline">
                    privacy@clarusapp.io
                  </a>
                </p>
                <p className="text-white/70 mt-1">
                  General support:{" "}
                  <a href="mailto:support@clarusapp.io" className="text-brand hover:underline">
                    support@clarusapp.io
                  </a>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <LandingFooter />
    </div>
  )
}
