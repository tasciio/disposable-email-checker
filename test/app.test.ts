import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Env } from "../src/types";

const app = createApp(new Set(["mailinator.com", "yopmail.com"]));

function testEnv(options: { allowed?: boolean; origins?: string; fail?: boolean } = {}): Env {
  return {
    ALLOWED_ORIGINS: options.origins ?? "*",
    API_RATE_LIMIT: {
      limit: options.fail
        ? vi.fn().mockRejectedValue(new Error("binding unavailable"))
        : vi.fn().mockResolvedValue({ success: options.allowed ?? true }),
    },
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("public routes", () => {
  it("publishes service metadata, health, and OpenAPI", async () => {
    const root = await app.fetch(new Request("https://api.example/"), testEnv());
    const health = await app.fetch(new Request("https://api.example/health"), testEnv());
    const spec = await app.fetch(new Request("https://api.example/openapi.json"), testEnv());

    expect(root.status).toBe(200);
    expect(await json(root)).toMatchObject({ version: "1.0.0", blacklistDomains: 2 });
    expect(await json(health)).toEqual({ status: "ok" });
    expect(await json(spec)).toMatchObject({ openapi: "3.1.0" });
  });

  it("returns generic 404 and 405 errors", async () => {
    const missing = await app.fetch(new Request("https://api.example/domains"), testEnv());
    const wrongMethod = await app.fetch(
      new Request("https://api.example/health", { method: "DELETE" }),
      testEnv(),
    );

    expect(missing.status).toBe(404);
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get("Allow")).toBe("GET, OPTIONS");
  });
});

describe("GET /v1/check", () => {
  it("checks emails without returning the full email address", async () => {
    const response = await app.fetch(
      new Request("https://api.example/v1/check?email=private%2Btag%40mx.mailinator.com", {
        headers: { "CF-Connecting-IP": "203.0.113.7" },
      }),
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({
      domain: "mx.mailinator.com",
      disposable: true,
      matchedDomain: "mailinator.com",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("checks clean domains", async () => {
    const response = await app.fetch(
      new Request("https://api.example/v1/check?domain=example.com"),
      testEnv(),
    );
    expect(await json(response)).toEqual({
      domain: "example.com",
      disposable: false,
      matchedDomain: null,
    });
    expect(response.headers.get("Cache-Control")).toContain("max-age=300");
  });

  it.each([
    "https://api.example/v1/check",
    "https://api.example/v1/check?email=a%40example.com&domain=example.com",
    "https://api.example/v1/check?domain=example.com&domain=example.org",
    "https://api.example/v1/check?other=example.com",
    "https://api.example/v1/check?email=not-an-email",
  ])("rejects malformed input: %s", async (url) => {
    const response = await app.fetch(new Request(url), testEnv());
    expect(response.status).toBe(400);
  });
});

describe("POST /v1/check", () => {
  it("accepts a small JSON body and prevents response caching", async () => {
    const response = await app.fetch(
      new Request("https://api.example/v1/check", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ domain: "YOPMAIL.COM" }),
      }),
      testEnv(),
    );

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ disposable: true, matchedDomain: "yopmail.com" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("rejects invalid media, encoding, JSON, shape, and fields", async () => {
    const cases = [
      new Request("https://api.example/v1/check", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      }),
      new Request("https://api.example/v1/check", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
        body: "{}",
      }),
      new Request("https://api.example/v1/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
      new Request("https://api.example/v1/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      }),
      new Request("https://api.example/v1/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: "example.com", extra: true }),
      }),
    ];

    for (const request of cases) {
      const response = await app.fetch(request, testEnv());
      expect([400, 415]).toContain(response.status);
    }
  });

  it("stops reading bodies larger than 1 KiB", async () => {
    const response = await app.fetch(
      new Request("https://api.example/v1/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: `${"a".repeat(1_100)}.example` }),
      }),
      testEnv(),
    );
    expect(response.status).toBe(413);
    expect(await json(response)).toMatchObject({ error: { code: "payload_too_large" } });
  });
});

describe("API protections", () => {
  it("returns 429 with Retry-After when the native limiter rejects a request", async () => {
    const response = await app.fetch(
      new Request("https://api.example/v1/check?domain=example.com"),
      testEnv({ allowed: false }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
  });

  it("fails closed if the rate-limit binding is absent or unavailable", async () => {
    const absent = await app.fetch(
      new Request("https://api.example/v1/check?domain=example.com"),
      { ALLOWED_ORIGINS: "*" },
    );
    const unavailable = await app.fetch(
      new Request("https://api.example/v1/check?domain=example.com"),
      testEnv({ fail: true }),
    );
    expect(absent.status).toBe(503);
    expect(unavailable.status).toBe(503);
  });

  it("adds restrictive security headers", async () => {
    const response = await app.fetch(new Request("https://api.example/health"), testEnv());
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("supports public preflights and rejects unapproved origins", async () => {
    const preflight = await app.fetch(
      new Request("https://api.example/v1/check", {
        method: "OPTIONS",
        headers: {
          Origin: "https://client.example",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "content-type",
        },
      }),
      testEnv(),
    );
    const forbidden = await app.fetch(
      new Request("https://api.example/health", {
        headers: { Origin: "https://evil.example" },
      }),
      testEnv({ origins: "https://app.example" }),
    );

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(preflight.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(forbidden.status).toBe(403);
    expect(forbidden.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
});
