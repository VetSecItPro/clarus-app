import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface HeroDemoProps extends Record<string, unknown> {
  title: string;
}

/**
 * Hero section product demo animation.
 * Shows a simulated content analysis workflow:
 * 1. URL input appears
 * 2. Analysis progress bar fills
 * 3. Result cards fan out
 *
 * Replace this with your actual product demo when ready.
 */
export const HeroDemo: React.FC<HeroDemoProps> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: URL input slides in (frames 0-30)
  const urlSlide = spring({ frame, fps, config: { damping: 15 } });

  // Phase 2: Progress bar fills (frames 40-120)
  const progressWidth = interpolate(frame, [40, 120], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 3: Result cards appear (frames 130+)
  const card1 = spring({
    frame: frame - 130,
    fps,
    config: { damping: 12 },
  });
  const card2 = spring({
    frame: frame - 145,
    fps,
    config: { damping: 12 },
  });
  const card3 = spring({
    frame: frame - 160,
    fps,
    config: { damping: 12 },
  });

  // Phase 4: Title fades in (frames 200+)
  const titleOpacity = interpolate(frame, [200, 230], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* URL Input Bar */}
      <div
        style={{
          position: "absolute",
          top: 200,
          transform: `translateY(${(1 - urlSlide) * 60}px)`,
          opacity: urlSlide,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 16,
          padding: "20px 40px",
          width: 800,
          display: "flex",
          alignItems: "center",
          gap: 16,
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#6366f1",
          }}
        />
        <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 22 }}>
          https://example.com/article-to-analyze
        </span>
      </div>

      {/* Progress Bar */}
      {frame >= 40 && (
        <div
          style={{
            position: "absolute",
            top: 320,
            width: 800,
            height: 6,
            background: "rgba(255,255,255,0.1)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressWidth}%`,
              height: "100%",
              background: "linear-gradient(90deg, #6366f1, #8b5cf6)",
              borderRadius: 3,
            }}
          />
        </div>
      )}

      {/* Result Cards */}
      <div
        style={{
          position: "absolute",
          top: 400,
          display: "flex",
          gap: 24,
          justifyContent: "center",
        }}
      >
        {[
          { label: "Bias Analysis", scale: card1, color: "#6366f1" },
          { label: "Key Claims", scale: card2, color: "#8b5cf6" },
          { label: "Summary", scale: card3, color: "#a78bfa" },
        ].map(({ label, scale, color }) => (
          <div
            key={label}
            style={{
              width: 240,
              height: 160,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              padding: 24,
              transform: `scale(${scale})`,
              opacity: scale,
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                background: color,
                borderRadius: 2,
                marginBottom: 16,
              }}
            />
            <div
              style={{ color: "white", fontSize: 20, fontWeight: 600 }}
            >
              {label}
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.5)",
                fontSize: 14,
                marginTop: 8,
              }}
            >
              AI-powered insight
            </div>
          </div>
        ))}
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          opacity: titleOpacity,
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "white",
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -1,
          }}
        >
          {title}
        </div>
      </div>
    </AbsoluteFill>
  );
};
