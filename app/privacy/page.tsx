import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Shield, Lock, Eye, Trash2, Download, Mail } from "lucide-react"

export const metadata: Metadata = {
  title: "Privacy Policy | Clarus",
  description: "Privacy Policy for Clarus - GDPR Compliant",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Simple Header */}
      <header className="border-b border-white/[0.08] bg-black/60 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-[#1d9bf0] to-[#1a8cd8] rounded-xl flex items-center justify-center shadow-lg">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
            <p className="text-white/50 text-sm">Last updated: December 2024</p>
          </div>
        </div>

        {/* GDPR Rights Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Eye className="w-5 h-5 text-[#1d9bf0] mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Right to Access</h3>
            <p className="text-white/50 text-xs">Request a copy of your data</p>
          </div>
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Trash2 className="w-5 h-5 text-[#1d9bf0] mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Right to Erasure</h3>
            <p className="text-white/50 text-xs">Request deletion of your data</p>
          </div>
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Download className="w-5 h-5 text-[#1d9bf0] mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Data Portability</h3>
            <p className="text-white/50 text-xs">Export your data</p>
          </div>
          <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <Mail className="w-5 h-5 text-[#1d9bf0] mb-2" />
            <h3 className="text-white font-medium text-sm mb-1">Contact DPO</h3>
            <p className="text-white/50 text-xs">privacy@clarusapp.io</p>
          </div>
        </div>

        {/* Privacy Content */}
        <div className="prose prose-invert max-w-none">
          <div className="space-y-8 text-white/70">
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">1. Introduction</h2>
              <p className="leading-relaxed">
                Clarus (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
                This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you use our service. We comply with the General Data Protection Regulation (GDPR)
                and other applicable data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">2. Data We Collect</h2>
              <p className="leading-relaxed mb-3">
                We collect minimal data necessary to provide our service:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Account Information:</strong> Email address and name when you create an account</li>
                <li><strong className="text-white">Content URLs:</strong> URLs you submit for analysis</li>
                <li><strong className="text-white">Analysis History:</strong> Records of content you&apos;ve analyzed</li>
                <li><strong className="text-white">Usage Data:</strong> Basic information about how you interact with our service</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong className="text-white">We do NOT collect:</strong> Marketing preferences, social media activity,
                browsing history outside our service, or any data for advertising purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">3. How We Use Your Data</h2>
              <p className="leading-relaxed mb-3">
                We use your data solely to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide and maintain our content analysis service</li>
                <li>Authenticate your account and maintain security</li>
                <li>Store and display your analysis history</li>
                <li>Improve our AI analysis capabilities</li>
                <li>Communicate with you about service updates</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">4. Cookie Policy</h2>
              <p className="leading-relaxed mb-3">
                We use only essential cookies required for the service to function:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Authentication Cookies:</strong> To keep you logged in securely</li>
                <li><strong className="text-white">Preference Cookies:</strong> To remember your settings (stored locally)</li>
              </ul>
              <p className="leading-relaxed mt-4">
                <strong className="text-white">We do NOT use:</strong> Analytics cookies, marketing cookies,
                advertising cookies, or any third-party tracking cookies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">5. Your Rights (GDPR)</h2>
              <p className="leading-relaxed mb-3">
                Under GDPR, you have the following rights regarding your personal data:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Right of Access:</strong> Request a copy of your personal data</li>
                <li><strong className="text-white">Right to Rectification:</strong> Request correction of inaccurate data</li>
                <li><strong className="text-white">Right to Erasure:</strong> Request deletion of your data (&quot;right to be forgotten&quot;)</li>
                <li><strong className="text-white">Right to Data Portability:</strong> Receive your data in a portable format</li>
                <li><strong className="text-white">Right to Object:</strong> Object to certain processing of your data</li>
                <li><strong className="text-white">Right to Restrict Processing:</strong> Request limitation of processing</li>
              </ul>
              <p className="leading-relaxed mt-4">
                To exercise any of these rights, please contact us at{" "}
                <a href="mailto:privacy@clarusapp.io" className="text-[#1d9bf0] hover:underline">
                  privacy@clarusapp.io
                </a>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. Data Retention</h2>
              <p className="leading-relaxed">
                We retain your personal data only for as long as necessary to provide our service
                and fulfill the purposes outlined in this policy. When you delete your account,
                we will delete or anonymize your personal data within 30 days, unless we are
                required by law to retain it longer.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">7. Data Security</h2>
              <p className="leading-relaxed">
                We implement appropriate technical and organizational measures to protect your
                personal data against unauthorized access, alteration, disclosure, or destruction.
                This includes encryption of data in transit and at rest, secure authentication
                mechanisms, and regular security assessments.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">8. Third-Party Services</h2>
              <p className="leading-relaxed mb-3">
                We use the following third-party services to provide our service:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong className="text-white">Supabase:</strong> Authentication and database services (data processing)</li>
                <li><strong className="text-white">Vercel:</strong> Hosting and deployment (data processing)</li>
                <li><strong className="text-white">OpenRouter:</strong> AI analysis services (data processing)</li>
              </ul>
              <p className="leading-relaxed mt-4">
                These services process data on our behalf under strict data processing agreements
                that ensure GDPR compliance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">9. International Data Transfers</h2>
              <p className="leading-relaxed">
                Your data may be transferred to and processed in countries outside of your residence.
                When we transfer data internationally, we ensure appropriate safeguards are in place,
                such as Standard Contractual Clauses approved by the European Commission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">10. Children&apos;s Privacy</h2>
              <p className="leading-relaxed">
                Our service is not intended for children under 16 years of age. We do not knowingly
                collect personal data from children. If you believe we have collected data from a child,
                please contact us immediately.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
              <p className="leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any
                significant changes by posting the new policy on this page and updating the
                &quot;Last updated&quot; date. We encourage you to review this policy periodically.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">12. Contact Us</h2>
              <p className="leading-relaxed mb-3">
                If you have questions about this Privacy Policy or wish to exercise your data protection rights:
              </p>
              <div className="p-4 bg-white/[0.04] border border-white/[0.08] rounded-xl mt-4">
                <p className="text-white/70 mb-2">
                  <strong className="text-white">Data Protection Officer:</strong>
                </p>
                <p className="text-white/70">
                  Email:{" "}
                  <a href="mailto:privacy@clarusapp.io" className="text-[#1d9bf0] hover:underline">
                    privacy@clarusapp.io
                  </a>
                </p>
                <p className="text-white/70 mt-2">
                  For general inquiries:{" "}
                  <a href="mailto:support@clarusapp.io" className="text-[#1d9bf0] hover:underline">
                    support@clarusapp.io
                  </a>
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">13. Supervisory Authority</h2>
              <p className="leading-relaxed">
                If you are located in the European Economic Area and believe we have not adequately
                addressed your data protection concerns, you have the right to lodge a complaint
                with your local data protection supervisory authority.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
