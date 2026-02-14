import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Rss, Youtube, Lock } from "lucide-react"

export const metadata: Metadata = {
  title: "Feed Subscription Guide | Clarus",
  description: "How to subscribe to public and private podcast and YouTube feeds in Clarus.",
}

export default function FeedsGuidePage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <main id="main-content" className="max-w-2xl mx-auto px-4 py-8 pb-24 sm:pb-8">
        {/* Back link */}
        <Link
          href="/feeds"
          className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/70 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Feeds
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">Feed Subscription Guide</h1>
        <p className="text-white/50 text-sm mb-10">
          How to find and subscribe to podcast and YouTube feeds in Clarus.
        </p>

        {/* === PODCASTS === */}
        <section className="mb-12">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center">
              <Rss className="w-4 h-4 text-brand" />
            </div>
            <h2 className="text-lg font-semibold text-white">Podcasts</h2>
          </div>

          {/* Public */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-white/80 mb-3">Public Podcasts</h3>
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p>
                Most podcasts have a public RSS feed URL. To find it:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-1">
                <li>Go to the podcast&apos;s website or hosting page (Spotify, Apple Podcasts, etc.)</li>
                <li>Look for an RSS icon or &ldquo;RSS Feed&rdquo; link — it usually ends in <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded text-xs">.xml</code> or <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded text-xs">/feed</code></li>
                <li>Copy the URL and paste it into the Add Podcast dialog</li>
              </ol>
              <p className="text-white/40 text-xs mt-2">
                Tip: Search &ldquo;[podcast name] rss feed&rdquo; — most hosting platforms publish the feed URL publicly.
              </p>
            </div>
          </div>

          {/* Private */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-sm font-medium text-white/80">Private / Premium Podcasts</h3>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                Pro
              </span>
            </div>
            <div className="space-y-3 text-sm text-white/60 leading-relaxed">
              <p>
                Premium podcasts from Patreon, Supercast, Supporting Cast, and similar platforms give each subscriber a <strong className="text-white/80">unique private RSS feed URL</strong> with your authentication built in.
              </p>

              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] divide-y divide-white/[0.06]">
                <PlatformRow
                  name="Patreon"
                  steps="Patreon → Your Memberships → [Creator] → Membership → RSS Feed link"
                />
                <PlatformRow
                  name="Supercast"
                  steps="Check your subscription confirmation email for your unique feed URL"
                />
                <PlatformRow
                  name="Apple Podcasts"
                  steps="Podcasts app → Library → Subscriber feed → Share → Copy Link"
                />
                <PlatformRow
                  name="Supporting Cast"
                  steps="Check your subscription email or account dashboard for the RSS URL"
                />
              </div>

              <p>
                Paste the full private URL into the Add Podcast dialog — it works just like a public feed. The token in the URL authenticates you automatically.
              </p>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/50 text-xs">
                <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-white/40" />
                <div>
                  <p>
                    <strong className="text-white/70">For feeds that require an Authorization header</strong> (self-hosted, enterprise, or custom setups), expand the &ldquo;Private feed authentication&rdquo; section in the dialog and enter your header value. Stored with AES-256 encryption.
                  </p>
                </div>
              </div>

              <p className="text-white/40 text-xs">
                Private feed URLs contain your personal access token. Never share them publicly. Clarus stores them securely and prompts you to refresh credentials every 90 days.
              </p>
            </div>
          </div>
        </section>

        {/* === YOUTUBE === */}
        <section className="mb-12">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Youtube className="w-4 h-4 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">YouTube</h2>
          </div>

          <div className="space-y-3 text-sm text-white/60 leading-relaxed">
            <p>
              YouTube channels have public Atom feeds. You can subscribe using either:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-1">
              <li>
                <strong className="text-white/70">Channel URL</strong> — paste the channel page URL directly (e.g., <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded text-xs">youtube.com/@ChannelName</code>). Clarus resolves the feed automatically.
              </li>
              <li>
                <strong className="text-white/70">Feed URL</strong> — use the direct Atom feed: <code className="text-white/70 bg-white/5 px-1.5 py-0.5 rounded text-xs break-all">youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID</code>
              </li>
            </ul>
            <p className="text-white/40 text-xs mt-2">
              To find a channel ID: go to the channel page → View Page Source → search for &ldquo;channel_id&rdquo;. Or use a free Channel ID lookup tool online.
            </p>
          </div>
        </section>

        {/* === HOW IT WORKS === */}
        <section>
          <h2 className="text-lg font-semibold text-white mb-4">How feed monitoring works</h2>
          <div className="space-y-3 text-sm text-white/60 leading-relaxed">
            <ol className="list-decimal list-inside space-y-2 ml-1">
              <li>Clarus checks your subscribed feeds daily for new episodes and videos</li>
              <li>New content appears in your feed dashboard with one-click analysis</li>
              <li>You choose which episodes or videos to analyze — nothing is processed automatically</li>
              <li>If a feed fails repeatedly (7 days), it&apos;s auto-paused and you&apos;ll see a warning</li>
            </ol>
          </div>
        </section>

        {/* Back to feeds */}
        <div className="mt-12 pt-8 border-t border-white/[0.06]">
          <Link
            href="/feeds"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Feeds
          </Link>
        </div>
      </main>
    </div>
  )
}

function PlatformRow({ name, steps }: { name: string; steps: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-white/70 text-sm font-medium w-28 shrink-0">{name}</span>
      <span className="text-white/50 text-xs leading-relaxed">{steps}</span>
    </div>
  )
}
