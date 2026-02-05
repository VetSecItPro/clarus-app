import { describe, it, expect } from "vitest"
import { parseAiResponse, parseAiResponseOrThrow } from "@/lib/ai-response-parser"
import type { ParseResult } from "@/lib/ai-response-parser"

// =============================================================================
// parseAiResponse — happy path (direct JSON)
// =============================================================================

describe("parseAiResponse — direct JSON", () => {
  it("parses clean JSON object", () => {
    const result = parseAiResponse<{ name: string }>('{"name": "test"}')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("test")
      expect(result.usedFallback).toBe(false)
    }
  })

  it("parses clean JSON array", () => {
    const result = parseAiResponse<string[]>('["a", "b", "c"]')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(["a", "b", "c"])
      expect(result.usedFallback).toBe(false)
    }
  })

  it("parses JSON with whitespace", () => {
    const result = parseAiResponse<{ key: string }>('  { "key": "value" }  ')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key).toBe("value")
    }
  })

  it("parses nested JSON objects", () => {
    const input = '{"outer": {"inner": [1, 2, 3]}}'
    const result = parseAiResponse<{ outer: { inner: number[] } }>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.outer.inner).toEqual([1, 2, 3])
    }
  })
})

// =============================================================================
// parseAiResponse — markdown code fences
// =============================================================================

describe("parseAiResponse — markdown code fences", () => {
  it("extracts JSON from ```json fence", () => {
    const input = '```json\n{"key": "value"}\n```'
    const result = parseAiResponse<{ key: string }>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key).toBe("value")
      expect(result.usedFallback).toBe(true)
    }
  })

  it("extracts JSON from bare ``` fence", () => {
    const input = '```\n{"key": "value"}\n```'
    const result = parseAiResponse<{ key: string }>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key).toBe("value")
      expect(result.usedFallback).toBe(true)
    }
  })

  it("extracts JSON from ```JSON fence (uppercase)", () => {
    const input = '```JSON\n{"key": "value"}\n```'
    const result = parseAiResponse<{ key: string }>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key).toBe("value")
    }
  })
})

// =============================================================================
// parseAiResponse — JSON from prose
// =============================================================================

describe("parseAiResponse — JSON extraction from prose", () => {
  it("extracts JSON object from surrounding prose", () => {
    const input = 'Here is the analysis result:\n{"score": 8, "summary": "Good article"}\nLet me know if you need more.'
    const result = parseAiResponse<{ score: number; summary: string }>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.score).toBe(8)
      expect(result.data.summary).toBe("Good article")
      expect(result.usedFallback).toBe(true)
    }
  })

  it("extracts JSON array from surrounding prose", () => {
    const input = 'Sure! Here are the results:\n[1, 2, 3]\nHope this helps!'
    const result = parseAiResponse<number[]>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3])
    }
  })

  it("handles JSON with strings containing braces", () => {
    const input = 'Result:\n{"text": "Hello {world}"}'
    const result = parseAiResponse<{ text: string }>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.text).toBe("Hello {world}")
    }
  })
})

// =============================================================================
// parseAiResponse — truncated JSON repair
// =============================================================================

describe("parseAiResponse — truncated JSON repair", () => {
  it("repairs JSON with missing closing brace", () => {
    const input = '{"key": "value", "nested": {"inner": "data"}'
    const result = parseAiResponse<Record<string, unknown>>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.usedFallback).toBe(true)
    }
  })

  it("repairs JSON with missing closing bracket", () => {
    const input = '["a", "b", "c"'
    const result = parseAiResponse<string[]>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(["a", "b", "c"])
      expect(result.usedFallback).toBe(true)
    }
  })

  it("repairs JSON with trailing comma", () => {
    const input = '{"a": 1, "b": 2,'
    const result = parseAiResponse<Record<string, number>>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.a).toBe(1)
      expect(result.data.b).toBe(2)
    }
  })

  it("repairs JSON with unclosed string", () => {
    const input = '{"key": "value", "partial": "unclosed'
    const result = parseAiResponse<Record<string, string>>(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.key).toBe("value")
    }
  })
})

// =============================================================================
// parseAiResponse — failure cases
// =============================================================================

describe("parseAiResponse — failure cases", () => {
  it("returns failure for empty string", () => {
    const result = parseAiResponse("")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("Empty or non-string")
    }
  })

  it("returns failure for null input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = parseAiResponse(null as any)
    expect(result.success).toBe(false)
  })

  it("returns failure for completely non-JSON text", () => {
    const result = parseAiResponse("This is just a plain text response with no JSON at all.")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("Unable to extract valid JSON")
    }
  })

  it("includes raw text in failure result (truncated if long)", () => {
    const longText = "No JSON here. ".repeat(100)
    const result: ParseResult<unknown> = parseAiResponse(longText)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.raw.length).toBeLessThanOrEqual(503) // 500 + "..."
    }
  })
})

// =============================================================================
// parseAiResponseOrThrow
// =============================================================================

describe("parseAiResponseOrThrow", () => {
  it("returns data for valid JSON", () => {
    const data = parseAiResponseOrThrow<{ x: number }>('{"x": 42}')
    expect(data.x).toBe(42)
  })

  it("throws for invalid JSON", () => {
    expect(() => parseAiResponseOrThrow("not json")).toThrow()
  })

  it("includes context in error message when provided", () => {
    expect(() => parseAiResponseOrThrow("bad", "tone_detection")).toThrow("tone_detection")
  })

  it("throws without context prefix when none provided", () => {
    try {
      parseAiResponseOrThrow("bad input")
      expect.fail("Should have thrown")
    } catch (e) {
      expect((e as Error).message).not.toContain("[")
    }
  })
})
