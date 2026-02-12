import Link from "next/link"

interface FeatureStep {
  number: string
  title: string
  description: string
}

interface FeaturePageProps {
  badge: string
  title: string
  subtitle: string
  description: string
  steps: FeatureStep[]
  benefits: string[]
  relatedFeatures: { title: string; href: string; description: string }[]
}

export function FeaturePage({
  badge,
  title,
  subtitle,
  description,
  steps,
  benefits,
  relatedFeatures,
}: FeaturePageProps) {
  return (
    <main className="max-w-4xl mx-auto px-4 lg:px-6 py-16">
      {/* Hero */}
      <div className="text-center mb-16">
        <span className="inline-block px-3 py-1.5 rounded-full bg-brand/10 border border-brand/20 text-xs font-medium text-brand mb-6">
          {badge}
        </span>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
          {title}
        </h1>
        <p className="text-lg text-white/50 max-w-2xl mx-auto mb-3">
          {subtitle}
        </p>
      </div>

      {/* Description */}
      <div className="prose prose-invert max-w-none mb-16">
        <p className="text-base text-white/60 leading-relaxed max-w-3xl mx-auto text-center">
          {description}
        </p>
      </div>

      {/* How it works */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-white mb-8 text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6"
            >
              <div className="w-8 h-8 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-sm font-semibold text-brand mb-4">
                {step.number}
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="mb-16">
        <h2 className="text-xl font-semibold text-white mb-8 text-center">What you get</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
          {benefits.map((benefit) => (
            <div
              key={benefit}
              className="flex items-start gap-3 p-4 bg-white/[0.03] border border-white/[0.06] rounded-xl"
            >
              <div className="w-5 h-5 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mt-0.5 shrink-0">
                <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm text-white/70">{benefit}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Related Features */}
      <section>
        <h2 className="text-xl font-semibold text-white mb-8 text-center">Related features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {relatedFeatures.map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 hover:bg-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <h3 className="text-sm font-semibold text-white group-hover:text-brand transition-colors mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-white/40">{feature.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
