import { domainFromEmail, isDisposableDomain, normalizeDomain } from "./domain";
import { OPENAPI_DOCUMENT } from "./openapi";
import type { Env, WorkerApp } from "./types";

const MAX_BODY_BYTES = 1_024;
const MAX_URL_LENGTH = 2_048;
const RETRY_AFTER_SECONDS = 60;
const CHECK_PATH = "/v1/check";
const KNOWN_PATHS = new Set(["/", "/health", "/openapi.json", CHECK_PATH]);

interface CorsPolicy {
  allowed: boolean;
  allowOrigin?: string;
  varyOrigin?: boolean;
}

class PayloadTooLargeError extends Error {}
class InvalidUtf8Error extends Error {}

function resolveCors(request: Request, env: Env): CorsPolicy {
  const origin = request.headers.get("Origin");
  if (origin === null) {
    return { allowed: true };
  }
  if (origin.length > 512) {
    return { allowed: false };
  }

  const configured = env.ALLOWED_ORIGINS === undefined ? "*" : env.ALLOWED_ORIGINS.trim();
  if (configured === "*") {
    return { allowed: true, allowOrigin: "*" };
  }

  const allowlist = configured
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return allowlist.includes(origin)
    ? { allowed: true, allowOrigin: origin, varyOrigin: true }
    : { allowed: false, varyOrigin: true };
}

function baseHeaders(cors: CorsPolicy, cacheControl = "no-store"): Headers {
  const headers = new Headers({
    "Cache-Control": cacheControl,
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-Robots-Tag": "noindex, nofollow",
  });

  if (cors.allowOrigin !== undefined) {
    headers.set("Access-Control-Allow-Origin", cors.allowOrigin);
    headers.set("Access-Control-Expose-Headers", "Retry-After");
  }
  if (cors.varyOrigin === true) {
    headers.append("Vary", "Origin");
  }

  return headers;
}

function jsonResponse(
  body: unknown,
  status: number,
  cors: CorsPolicy,
  options: { cacheControl?: string; headers?: Record<string, string> } = {},
): Response {
  const headers = baseHeaders(cors, options.cacheControl);
  headers.set("Content-Type", "application/json; charset=utf-8");
  for (const [name, value] of Object.entries(options.headers ?? {})) {
    headers.set(name, value);
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  cors: CorsPolicy,
  headers?: Record<string, string>,
): Response {
  return jsonResponse({ error: { code, message } }, status, cors, { headers });
}

function methodNotAllowed(allowed: string[], cors: CorsPolicy): Response {
  return errorResponse(405, "method_not_allowed", "Method not allowed for this route.", cors, {
    Allow: allowed.join(", "),
  });
}

function clientRateLimitKey(request: Request): string {
  const connectingIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (
    connectingIp === undefined ||
    connectingIp.length === 0 ||
    connectingIp.length > 64 ||
    !/^[0-9a-f:.]+$/i.test(connectingIp)
  ) {
    return "check:unknown";
  }
  return `check:${connectingIp}`;
}

async function enforceRateLimit(request: Request, env: Env, cors: CorsPolicy): Promise<Response | null> {
  if (env.API_RATE_LIMIT === undefined) {
    return errorResponse(
      503,
      "service_unavailable",
      "The API is temporarily unavailable.",
      cors,
      { "Retry-After": String(RETRY_AFTER_SECONDS) },
    );
  }

  try {
    const result = await env.API_RATE_LIMIT.limit({ key: clientRateLimitKey(request) });
    if (!result.success) {
      return errorResponse(429, "rate_limited", "Too many requests. Try again later.", cors, {
        "Retry-After": String(RETRY_AFTER_SECONDS),
      });
    }
  } catch {
    return errorResponse(
      503,
      "service_unavailable",
      "The API is temporarily unavailable.",
      cors,
      { "Retry-After": String(RETRY_AFTER_SECONDS) },
    );
  }

  return null;
}

function validatePreflight(request: Request, path: string, cors: CorsPolicy): Response {
  if (request.headers.get("Origin") === null) {
    return errorResponse(400, "invalid_preflight", "An Origin header is required.", cors);
  }

  const allowedMethods = path === CHECK_PATH ? ["GET", "POST", "OPTIONS"] : ["GET", "OPTIONS"];
  const requestedMethod = request.headers.get("Access-Control-Request-Method")?.toUpperCase();
  if (requestedMethod === undefined) {
    return errorResponse(
      400,
      "invalid_preflight",
      "An Access-Control-Request-Method header is required.",
      cors,
    );
  }
  if (!allowedMethods.includes(requestedMethod)) {
    return methodNotAllowed(allowedMethods, cors);
  }

  const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") ?? "")
    .split(",")
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some((header) => header !== "content-type")) {
    return errorResponse(
      403,
      "cors_header_forbidden",
      "The requested CORS headers are not allowed.",
      cors,
    );
  }

  const headers = baseHeaders(cors, "public, max-age=86400");
  headers.set("Access-Control-Allow-Methods", allowedMethods.join(", "));
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Allow", allowedMethods.join(", "));
  return new Response(null, { status: 204, headers });
}

function checkInput(
  kind: "email" | "domain",
  value: unknown,
  blacklist: ReadonlySet<string>,
  cors: CorsPolicy,
  cacheControl: string,
): Response {
  if (typeof value !== "string") {
    return errorResponse(400, `invalid_${kind}`, `${kind} must be a string.`, cors);
  }

  const domain = kind === "email" ? domainFromEmail(value) : normalizeDomain(value);
  if (domain === null) {
    return errorResponse(400, `invalid_${kind}`, `A valid ${kind} is required.`, cors);
  }

  return jsonResponse({ disposable: isDisposableDomain(domain, blacklist) }, 200, cors, {
    cacheControl,
  });
}

function getCheckResponse(
  url: URL,
  blacklist: ReadonlySet<string>,
  cors: CorsPolicy,
): Response {
  const keys: string[] = [];
  url.searchParams.forEach((_value, key) => keys.push(key));
  if (keys.some((key) => key !== "email" && key !== "domain")) {
    return errorResponse(400, "unknown_parameter", "Only email or domain may be provided.", cors);
  }

  const emails = url.searchParams.getAll("email");
  const domains = url.searchParams.getAll("domain");
  if (emails.length + domains.length !== 1) {
    return errorResponse(
      400,
      "invalid_request",
      "Provide exactly one email or domain parameter.",
      cors,
    );
  }

  return emails.length === 1
    ? checkInput("email", emails[0], blacklist, cors, "no-store")
    : checkInput("domain", domains[0], blacklist, cors, "public, max-age=300");
}

async function readBoundedBody(request: Request): Promise<string> {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new InvalidUtf8Error("Invalid Content-Length");
    }
    if (Number(contentLength) > MAX_BODY_BYTES) {
      throw new PayloadTooLargeError();
    }
  }

  if (request.body === null) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new PayloadTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidUtf8Error("The request body is not valid UTF-8");
  }
}

async function postCheckResponse(
  request: Request,
  blacklist: ReadonlySet<string>,
  cors: CorsPolicy,
): Promise<Response> {
  const contentEncoding = request.headers.get("Content-Encoding");
  if (contentEncoding !== null && contentEncoding.toLowerCase() !== "identity") {
    return errorResponse(
      415,
      "unsupported_content_encoding",
      "Compressed request bodies are not supported.",
      cors,
    );
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!/^application\/json(?:\s*;\s*charset=(?:utf-8|"utf-8"))?\s*$/i.test(contentType)) {
    return errorResponse(415, "unsupported_media_type", "Content-Type must be application/json.", cors);
  }

  let text: string;
  try {
    text = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return errorResponse(
        413,
        "payload_too_large",
        `Request bodies are limited to ${MAX_BODY_BYTES} bytes.`,
        cors,
      );
    }
    return errorResponse(400, "invalid_body", "The request body is invalid.", cors);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return errorResponse(400, "invalid_json", "The request body must be valid JSON.", cors);
  }

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return errorResponse(400, "invalid_request", "The request body must be a JSON object.", cors);
  }

  const record = payload as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => key !== "email" && key !== "domain")) {
    return errorResponse(400, "unknown_field", "Only email or domain may be provided.", cors);
  }

  const hasEmail = Object.prototype.hasOwnProperty.call(record, "email");
  const hasDomain = Object.prototype.hasOwnProperty.call(record, "domain");
  if (Number(hasEmail) + Number(hasDomain) !== 1) {
    return errorResponse(400, "invalid_request", "Provide exactly one email or domain field.", cors);
  }

  return hasEmail
    ? checkInput("email", record.email, blacklist, cors, "no-store")
    : checkInput("domain", record.domain, blacklist, cors, "no-store");
}

async function handleRequest(
  request: Request,
  env: Env,
  blacklist: ReadonlySet<string>,
): Promise<Response> {
  const cors = resolveCors(request, env);
  if (!cors.allowed) {
    return errorResponse(403, "origin_forbidden", "This origin is not allowed.", cors);
  }
  if (request.url.length > MAX_URL_LENGTH) {
    return errorResponse(414, "uri_too_long", "The request URL is too long.", cors);
  }

  const url = new URL(request.url);
  if (!KNOWN_PATHS.has(url.pathname)) {
    return errorResponse(404, "not_found", "Route not found.", cors);
  }

  if (request.method === "OPTIONS") {
    return validatePreflight(request, url.pathname, cors);
  }

  if (url.pathname === CHECK_PATH) {
    const rateLimitResponse = await enforceRateLimit(request, env, cors);
    if (rateLimitResponse !== null) {
      return rateLimitResponse;
    }

    if (request.method === "GET") {
      return getCheckResponse(url, blacklist, cors);
    }
    if (request.method === "POST") {
      return postCheckResponse(request, blacklist, cors);
    }
    return methodNotAllowed(["GET", "POST", "OPTIONS"], cors);
  }

  if (request.method !== "GET") {
    return methodNotAllowed(["GET", "OPTIONS"], cors);
  }

  if (url.pathname === "/health") {
    return jsonResponse({ status: "ok" }, 200, cors, {
      cacheControl: "public, max-age=30",
    });
  }
  if (url.pathname === "/openapi.json") {
    return jsonResponse(OPENAPI_DOCUMENT, 200, cors, {
      cacheControl: "public, max-age=3600",
    });
  }

  return jsonResponse(
    {
      name: "Disposable Email Checker API",
      version: "1.0.0",
      blacklistDomains: blacklist.size,
      endpoints: {
        check: "/v1/check?email=user@example.com",
        health: "/health",
        openapi: "/openapi.json",
      },
    },
    200,
    cors,
    { cacheControl: "public, max-age=3600" },
  );
}

export function createApp(blacklist: ReadonlySet<string>): WorkerApp {
  return {
    async fetch(request, env) {
      try {
        return await handleRequest(request, env, blacklist);
      } catch {
        return errorResponse(
          500,
          "internal_error",
          "An unexpected error occurred.",
          resolveCors(request, env),
        );
      }
    },
  };
}
