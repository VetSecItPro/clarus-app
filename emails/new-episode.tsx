import { Link, Section, Text } from "@react-email/components"
import * as React from "react"
import { BaseEmail, baseStyles } from "./base-email"

interface EpisodeInfo {
  title: string
  podcastName: string
  date: string | null
  duration: string | null
}

interface NewEpisodeEmailProps {
  userName?: string
  episodes: EpisodeInfo[]
  podcastCount: number
}

export const NewEpisodeEmail = ({
  userName = "there",
  episodes,
  podcastCount,
}: NewEpisodeEmailProps) => {
  const episodeWord = episodes.length === 1 ? "episode" : "episodes"
  const podcastWord = podcastCount === 1 ? "podcast" : "podcasts"

  return (
    <BaseEmail previewText={`${episodes.length} new ${episodeWord} from your subscribed ${podcastWord}`}>
      <Text style={baseStyles.heading}>New episodes available</Text>

      <Text style={baseStyles.text}>Hi {userName},</Text>

      <Text style={baseStyles.text}>
        {episodes.length === 1
          ? "A new episode just dropped from one of your subscribed podcasts."
          : `${episodes.length} new ${episodeWord} just dropped from your subscribed ${podcastWord}.`}
      </Text>

      {episodes.slice(0, 10).map((episode, index) => (
        <Section
          key={index}
          style={{
            ...baseStyles.infoBox,
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            borderColor: "rgba(255, 255, 255, 0.08)",
          }}
        >
          <Text style={{ ...baseStyles.textMuted, margin: "0 0 4px 0", fontSize: "12px" }}>
            {episode.podcastName}
          </Text>
          <Text style={{ ...baseStyles.text, margin: "0 0 4px 0", fontWeight: "500" }}>
            {episode.title}
          </Text>
          {(episode.date || episode.duration) && (
            <Text style={{ ...baseStyles.textMuted, margin: "0", fontSize: "12px" }}>
              {[episode.date, episode.duration].filter(Boolean).join(" · ")}
            </Text>
          )}
        </Section>
      ))}

      {episodes.length > 10 && (
        <Text style={baseStyles.textMuted}>
          ...and {episodes.length - 10} more {episodes.length - 10 === 1 ? "episode" : "episodes"}.
        </Text>
      )}

      <Section style={baseStyles.buttonSection}>
        <Link href="https://clarusapp.io/podcasts" style={baseStyles.button}>
          View Episodes
        </Link>
      </Section>

      <Section style={baseStyles.divider} />

      <Text style={baseStyles.textMuted}>
        Choose which episodes to analyze — your quota is only used when you decide.
      </Text>

      <Text style={baseStyles.textMuted}>
        Manage your podcast subscriptions in{" "}
        <Link href="https://clarusapp.io/podcasts" style={baseStyles.link}>
          Podcasts
        </Link>
      </Text>
    </BaseEmail>
  )
}

NewEpisodeEmail.subject = "Clarus - New Podcast Episodes"

export default NewEpisodeEmail
