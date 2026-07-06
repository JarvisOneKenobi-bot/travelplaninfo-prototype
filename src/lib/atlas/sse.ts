// Shared SSE data-frame codec. Payloads may contain newlines: per the SSE
// spec each payload line gets its own `data: ` prefix and the receiver joins
// them with "\n". Single-line payloads encode byte-identically to the legacy
// `data: <payload>\n\n` format, so [TOOL:]/[DONE]/error frames are unchanged.

export function encodeSseData(payload: string): string {
  return payload.split("\n").map((line) => `data: ${line}`).join("\n") + "\n\n";
}

export function decodeSseData(frame: string): string | null {
  const dataLines = frame.split("\n").filter((line) => line.startsWith("data: "));
  if (dataLines.length === 0) return null;
  return dataLines.map((line) => line.slice(6)).join("\n");
}
