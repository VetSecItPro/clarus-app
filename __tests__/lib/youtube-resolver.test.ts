import { describe, it, expect } from "vitest"
import { extractYouTubeVideoId } from "@/lib/youtube-resolver"

// ---------------------------------------------------------------------------
// extractYouTubeVideoId — pure URL parser, no network calls
// ---------------------------------------------------------------------------
// resolveYouTubeChannel is async and hits the network (fetch/scrape), so we
// only test the exported pure function here.
// ---------------------------------------------------------------------------

describe("extractYouTubeVideoId", () => {
  // =========================================================================
  // Standard watch URLs
  // =========================================================================

  describe("youtube.com/watch?v= URLs", () => {
    it("extracts video ID from standard watch URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    })

    it("extracts video ID without www prefix", () => {
      expect(extractYouTubeVideoId("https://youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    })

    it("extracts video ID with additional query params", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=abc123&t=60&list=PLxyz")).toBe("abc123")
    })

    it("extracts video ID when v is not the first param", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?list=PLxyz&v=def456")).toBe("def456")
    })

    it("extracts video ID from http:// URL", () => {
      expect(extractYouTubeVideoId("http://www.youtube.com/watch?v=abc123")).toBe("abc123")
    })
  })

  // =========================================================================
  // Short URLs (youtu.be)
  // =========================================================================

  describe("youtu.be short URLs", () => {
    it("extracts video ID from youtu.be", () => {
      expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    })

    it("extracts video ID from youtu.be with query params", () => {
      expect(extractYouTubeVideoId("https://youtu.be/abc123?t=30")).toBe("abc123")
    })
  })

  // =========================================================================
  // Embed and /v/ URLs
  // =========================================================================

  describe("embed and /v/ URLs", () => {
    it("extracts video ID from /embed/ URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    })

    it("extracts video ID from /v/ URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/v/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ")
    })

    it("extracts video ID from /embed/ with query params", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/embed/abc123?autoplay=1")).toBe("abc123")
    })
  })

  // =========================================================================
  // Non-video YouTube URLs (should return null)
  // =========================================================================

  describe("non-video YouTube URLs", () => {
    it("returns null for channel URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/channel/UCxxxxxx")).toBeNull()
    })

    it("returns null for handle URL", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/@somehandle")).toBeNull()
    })

    it("returns null for youtube.com homepage", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/")).toBeNull()
    })

    it("returns null for youtube.com/feed", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/feed/trending")).toBeNull()
    })
  })

  // =========================================================================
  // Invalid / non-YouTube URLs
  // =========================================================================

  describe("invalid and non-YouTube URLs", () => {
    it("extracts video ID even from non-YouTube domains (no hostname check)", () => {
      // extractYouTubeVideoId does not validate hostname — it only parses URL params/paths
      expect(extractYouTubeVideoId("https://example.com/watch?v=abc123")).toBe("abc123")
    })

    it("returns null for empty string", () => {
      expect(extractYouTubeVideoId("")).toBeNull()
    })

    it("returns null for plain text", () => {
      expect(extractYouTubeVideoId("not a url")).toBeNull()
    })

    it("returns null for undefined-like input", () => {
      expect(extractYouTubeVideoId("undefined")).toBeNull()
    })

    it("returns null for URL without video ID", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch")).toBeNull()
    })

    it("returns null for watch URL with empty v param", () => {
      expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=")).toBeNull()
    })
  })

  // =========================================================================
  // Edge cases
  // =========================================================================

  describe("edge cases", () => {
    it("handles mobile youtube URLs (m.youtube.com)", () => {
      // extractYouTubeVideoId uses new URL() which handles this
      expect(extractYouTubeVideoId("https://m.youtube.com/watch?v=abc123")).toBe("abc123")
    })

    it("handles video IDs with hyphens and underscores", () => {
      expect(extractYouTubeVideoId("https://youtu.be/a-b_c1D2E3f")).toBe("a-b_c1D2E3f")
    })
  })
})
