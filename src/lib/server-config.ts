import "server-only";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const DEFAULT_APP_BASE_URL = "http://localhost:3000";
const DEFAULT_FASTAPI_BASE_URL = "http://localhost:8766";

function readTrimmedEnv(name: string): string {
  const value = process.env[name]?.trim();
  return value ? value : "";
}

function readLegacyCredentialFile(
  fileName: string,
  candidateKeys: string[]
): string {
  try {
    const filePath = path.join(
      os.homedir(),
      ".openclaw",
      "credentials",
      fileName
    );
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
      string,
      unknown
    >;

    for (const key of candidateKeys) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  } catch {
    return "";
  }

  return "";
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function parseAbsoluteHttpUrl(url: string): URL | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getValidatedBaseUrl(candidates: string[], fallback: string): string {
  for (const candidate of candidates) {
    const parsed = parseAbsoluteHttpUrl(candidate);
    if (parsed) {
      return normalizeBaseUrl(parsed.toString());
    }
  }

  return fallback;
}

export function getAppBaseUrl(): string {
  return getValidatedBaseUrl(
    [readTrimmedEnv("APP_BASE_URL"), readTrimmedEnv("NEXTAUTH_URL")],
    DEFAULT_APP_BASE_URL
  );
}

export function getAuthenticatedAppBaseUrl(): string {
  return getValidatedBaseUrl(
    [readTrimmedEnv("APP_BASE_URL"), readTrimmedEnv("NEXTAUTH_URL")],
    DEFAULT_APP_BASE_URL
  );
}

export function getRequestAwareAppBaseUrl(origin?: string): string {
  const parsedOrigin = parseAbsoluteHttpUrl(origin?.trim() || "");
  return parsedOrigin ? normalizeBaseUrl(parsedOrigin.toString()) : getAppBaseUrl();
}

export function getFastApiBaseUrl(): string {
  return getValidatedBaseUrl(
    [readTrimmedEnv("FASTAPI_URL")],
    DEFAULT_FASTAPI_BASE_URL
  );
}

export function getAnthropicApiKey(): string {
  return (
    readTrimmedEnv("ANTHROPIC_API_KEY") ||
    readLegacyCredentialFile("anthropic.json", ["api_key"])
  );
}

export function getOpenAIApiKey(): string {
  return (
    readTrimmedEnv("OPENAI_API_KEY") ||
    readLegacyCredentialFile("openai.json", ["api_key", "key"])
  );
}
