import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDomainList } from "../src/domain";

const listPath = fileURLToPath(new URL("../data/domains.txt", import.meta.url));

describe("deployed domain list", () => {
  it("matches the valid, unique, and sorted pinned upstream snapshot", async () => {
    const contents = await readFile(listPath, "utf8");
    const domains = [...parseDomainList(contents)];
    const checksum = createHash("sha256").update(contents).digest("hex");

    expect(domains).toHaveLength(7_936);
    expect(domains).toEqual([...domains].sort());
    expect(checksum).toBe(
      "6812426525ad0b60e53104f47065f3fde0b7af48a85a3cbecb1f7e03a49e524e",
    );
  });
});
