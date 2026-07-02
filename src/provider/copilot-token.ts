import { isAbortError, ProviderError, sanitizeMessage } from "./provider-error.js";

export type TokenCacheEntry = {
  readonly token: string;
  readonly expiresAt: number;
  readonly apiBase: string;
};

const TOKEN_REFRESH_SKEW_SECONDS = 60;

const tokenCache: Map<string, TokenCacheEntry> = new Map();

export type SessionTokenSuccess = {
  readonly ok: true;
  readonly session: { readonly token: string; readonly apiBase: string };
};

export type SessionTokenFailure = {
  readonly ok: false;
  readonly error: ProviderError;
};

export type SessionTokenResult = SessionTokenSuccess | SessionTokenFailure;

export async function fetchAndCacheSessionToken(
  githubToken: string,
  tokenUrl: string,
  tokenHeaders: Readonly<Record<string, string>>,
  fetchImpl: typeof fetch,
  endpoint: "chat" | "responses",
  requestId: string,
): Promise<SessionTokenResult> {
  let response: Response;
  try {
    response = await fetchImpl(tokenUrl, {
      method: "GET",
      headers: tokenHeaders,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        error: new ProviderError(
          "timeout",
          endpoint,
          null,
          requestId,
          `Request to provider ${endpoint} timed out while fetching session token.`,
        ),
      };
    }
    return {
      ok: false,
      error: new ProviderError(
        "network",
        endpoint,
        null,
        requestId,
        sanitizeMessage(error, "Network error fetching Copilot session token."),
        { cause: error },
      ),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      error: new ProviderError(
        "chat_4xx",
        endpoint,
        response.status,
        requestId,
        `Copilot session token endpoint responded with HTTP ${response.status}.`,
      ),
    };
  }

  let rawText: string;
  try {
    rawText = await response.text();
  } catch (error) {
    return {
      ok: false,
      error: new ProviderError(
        "parse",
        endpoint,
        response.status,
        requestId,
        sanitizeMessage(error, "Failed to read Copilot session token body."),
        { cause: error },
      ),
    };
  }

  const envelope = safeParseJson(rawText);
  if (!isRecord(envelope)) {
    return {
      ok: false,
      error: new ProviderError(
        "parse",
        endpoint,
        response.status,
        requestId,
        "Copilot session token response was not a JSON object.",
      ),
    };
  }

  const token = readStringField(envelope, "token");
  const expiresAt = readNumberField(envelope, "expires_at");
  const endpoints = readRecordField(envelope, "endpoints");
  const chatApiBase = endpoints === null ? null : readStringField(endpoints, "api");

  if (token === null || expiresAt === null || chatApiBase === null) {
    return {
      ok: false,
      error: new ProviderError(
        "parse",
        endpoint,
        response.status,
        requestId,
        "Copilot session token envelope was missing required fields.",
      ),
    };
  }

  const cacheKey = buildCacheKey(githubToken);
  tokenCache.set(cacheKey, { token, expiresAt, apiBase: chatApiBase });
  return { ok: true, session: { token, apiBase: chatApiBase } };
}

export function getCachedSessionToken(
  githubToken: string,
): { readonly token: string; readonly apiBase: string } | undefined {
  const cacheKey = buildCacheKey(githubToken);
  const cached = tokenCache.get(cacheKey);
  if (cached === undefined) {
    return undefined;
  }
  const nowSeconds = Date.now() / 1000;
  if (nowSeconds + TOKEN_REFRESH_SKEW_SECONDS >= cached.expiresAt) {
    return undefined;
  }
  return { token: cached.token, apiBase: cached.apiBase };
}

export function clearCopilotTokenCache(): void {
  tokenCache.clear();
}

function buildCacheKey(githubToken: string): string {
  return githubToken;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readNumberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readRecordField(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  const inner = value[key];
  return isRecord(inner) ? inner : null;
}