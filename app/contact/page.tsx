import { Metadata } from "next"
import { Mail } from "lucide-react"
import { PublicHeader } from "@/components/public-header"
import { LandingFooter } from "@/components/landing/landing-footer"
import { ContactForm } from "./contact-form"

export const metadata: Metadata = {
  title: "Contact Us | Clarus",
  description: "Get in touch with the Clarus team. Questions about AI content analysis, pricing, or partnerships? We respond within 24 hours.",
  openGraph: {
    title: "Contact Us | Clarus",
    description: "Get in touch with the Clarus team. We respond within 24 hours.",
    url: "https://clarusapp.io/contact",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Contact Us | Clarus",
    description: "Get in touch with the Clarus team.",
  },
  alternates: {
    canonical: "https://clarusapp.io/contact",
  },
}

// ISR: revalidate every hour — page structure rarely changes
export const revalidate = 3600

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      <PublicHeader />

      <main id="main-content" className="flex-1 max-w-2xl mx-auto px-4 py-12 w-full">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-brand to-brand-hover rounded-xl flex items-center justify-center shadow-lg">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Contact Us</h1>
            <p className="text-white/40 text-sm">We&apos;ll get back to you as soon as possible.</p>
          </div>
        </div>

        <ContactForm />
      </main>

      <LandingFooter />
    </div>
  )
}
