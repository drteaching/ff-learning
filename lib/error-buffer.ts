/**
 * Client-side error ring buffer for the bug-reporting widget.
 *
 * Keeps a small, bounded record of recent client failures so a bug report can
 * carry useful telemetry without any always-on logging service:
 *  - uncaught errors + unhandled promise rejections (message, short stack)
 *  - failed fetch responses (status >= 400) with the query string stripped
 *
 * Browser-only. Safe to import from server code (it just no-ops there).
 */

export type ConsoleErrorEntry = {
  message: string;
  stack: string; // first 10 lines only
  timestamp: string; // ISO
};

export type NetworkErrorEntry = {
  url: string; // query string stripped
  status: number;
  body: string; // first 300 characters
  timestamp: string; // ISO
};

const MAX_ENTRIES = 20;

const consoleErrors: ConsoleErrorEntry[] = [];
const networkErrors: NetworkErrorEntry[] = [];
let initialised = false;

function pushBounded<T>(buffer: T[], entry: T) {
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

function firstLines(stack: string | undefined | null, count: number): string {
  if (!stack) return "";
  return stack.split("\n").slice(0, count).join("\n");
}

function stripQuery(rawUrl: string): string {
  try {
    const u = new URL(rawUrl, window.location.href);
    return `${u.origin}${u.pathname}`;
  } catch {
    return rawUrl.split("?")[0];
  }
}

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  if (input instanceof Request) return input.url;
  return String(input);
}

/** Initialise the buffer once. No-op on the server or if already initialised. */
export function initErrorBuffer() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  window.addEventListener("error", (event) => {
    pushBounded(consoleErrors, {
      message: String(
        event.message || event.error?.message || "Uncaught error",
      ),
      stack: firstLines(event.error?.stack, 10),
      timestamp: new Date().toISOString(),
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; stack?: string } | string;
    pushBounded(consoleErrors, {
      message:
        typeof reason === "string"
          ? reason
          : String(reason?.message || "Unhandled promise rejection"),
      stack: firstLines(typeof reason === "string" ? "" : reason?.stack, 10),
      timestamp: new Date().toISOString(),
    });
  });

  // Wrap fetch to record failed responses. Never let telemetry break the app.
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    try {
      if (response.status >= 400) {
        let body = "";
        try {
          body = (await response.clone().text()).slice(0, 300);
        } catch {
          // response body may not be readable; ignore
        }
        pushBounded(networkErrors, {
          url: stripQuery(requestUrl(args[0])),
          status: response.status,
          body,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // swallow — telemetry must never interfere with the real request
    }
    return response;
  };
}

/** Snapshot of the current buffers (copies, so callers can't mutate state). */
export function getErrorBuffer(): {
  consoleErrors: ConsoleErrorEntry[];
  networkErrors: NetworkErrorEntry[];
} {
  return {
    consoleErrors: [...consoleErrors],
    networkErrors: [...networkErrors],
  };
}
