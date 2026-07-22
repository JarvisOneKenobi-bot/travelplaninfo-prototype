import { describe, it, expect } from "vitest";
import { parseIata } from "./iata";

describe("parseIata", () => {
  it("accepts a 3-letter code, trimming + uppercasing", () => {
    expect(parseIata(" cun ")).toBe("CUN");
    expect(parseIata("MIA")).toBe("MIA");
  });
  it("rejects non-3-letter / non-alpha input", () => {
    expect(parseIata("CANCUN")).toBeNull();
    expect(parseIata("M1A")).toBeNull();
    expect(parseIata("mi'a")).toBeNull();
    expect(parseIata("KMIA")).toBeNull();
    expect(parseIata("")).toBeNull();
  });
});
