import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const wranglerPath = fileURLToPath(new URL("../wrangler.jsonc", import.meta.url));

describe("deployment privacy", () => {
  it("keeps persistent Workers observability disabled", async () => {
    const config = await readFile(wranglerPath, "utf8");

    expect(config).toMatch(/"observability"\s*:\s*\{[^}]*"enabled"\s*:\s*false[^}]*\}/su);
    expect(config).not.toMatch(/"invocation_logs"\s*:\s*true/su);
  });
});
