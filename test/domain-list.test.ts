import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDomainList } from "../src/domain";

const listPath = fileURLToPath(new URL("../data/domains.txt", import.meta.url));

describe("deployed domain list", () => {
  it("matches the valid, unique, and sorted snapshot plus local changes", async () => {
    const contents = await readFile(listPath, "utf8");
    const domains = [...parseDomainList(contents)];
    const checksum = createHash("sha256").update(contents).digest("hex");

    expect(domains).toHaveLength(7_940);
    expect(domains).toEqual([...domains].sort());
    expect(checksum).toBe(
      "bb822ea30ce6d74be4f9c8dd609a1990cebcef50577aeb37a696c52200b65dfc",
    );
    expect(domains).toContain("luckfeed.com");
    expect(domains).toContain("gwshare.com");
    expect(domains).toContain("practoso.com");
    expect(domains).toContain("inboxly.website");
  });
});
