const originalFetch = globalThis.fetch;
const base = process.env["UMACTUALLY_E2E_COPILOT_BASE"];
const originalRequest = globalThis.Request;

if (base !== undefined && base.length > 0) {
  globalThis.fetch = async (input, init) => {
    const inputUrl = input instanceof Request ? input.url : String(input);
    const parsed = new URL(inputUrl);
    if (parsed.origin !== "https://api.github.com" || !parsed.pathname.startsWith("/copilot_internal/")) {
      return originalFetch(input, init);
    }
    const reroutedUrl = new URL(`${parsed.pathname}${parsed.search}`, base).href;
    if (input instanceof originalRequest) {
      return originalFetch(new originalRequest(reroutedUrl, input), init);
    }
    return originalFetch(reroutedUrl, init);
  };
}

export {};
