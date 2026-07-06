import { describe, it, expect } from "vitest";
import { encodeSseData, decodeSseData } from "./sse";

describe("SSE codec", () => {
  it("encodes a single-line payload exactly like the legacy frame format", () => {
    expect(encodeSseData("hello")).toBe("data: hello\n\n");
    expect(encodeSseData("[DONE]")).toBe("data: [DONE]\n\n");
  });

  it("encodes embedded newlines as one data: line per payload line", () => {
    expect(encodeSseData("a\n\nb")).toBe("data: a\ndata: \ndata: b\n\n");
  });

  it("round-trips payloads containing newlines", () => {
    for (const payload of ["word", " leading space", "a\nb", "a\n\nb", "trailing\n", "\nleading", ""]) {
      expect(decodeSseData(encodeSseData(payload))).toBe(payload);
    }
  });

  it("decodes an event whether or not the trailing blank line is present", () => {
    expect(decodeSseData("data: a\ndata: b")).toBe("a\nb");
    expect(decodeSseData("data: a\ndata: b\n\n")).toBe("a\nb");
  });

  it("returns null for an event with no data lines", () => {
    expect(decodeSseData(": comment only")).toBeNull();
    expect(decodeSseData("")).toBeNull();
  });
});
