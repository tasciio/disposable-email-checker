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

    expect(domains).toHaveLength(7_939);
    expect(domains).toEqual([...domains].sort());
    expect(checksum).toBe(
      "87f3f691a4fe76120765a3a038340d98627392a26524d185baff5352ba2ce492",
    );
    expect(domains).toContain("luckfeed.com");
    expect(domains).toContain("gwshare.com");
    expect(domains).toContain("practoso.com");
  });
});
