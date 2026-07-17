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

    expect(domains).toHaveLength(7_937);
    expect(domains).toEqual([...domains].sort());
    expect(checksum).toBe(
      "77d79c9ce1a1961b18f13072814078d1427ae898a9d0b07c8108804936d3c032",
    );
    expect(domains).toContain("luckfeed.com");
  });
});
