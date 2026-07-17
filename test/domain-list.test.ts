import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDomainList } from "../src/domain";

const listPath = fileURLToPath(new URL("../data/domains.txt", import.meta.url));

describe("deployed domain list", () => {
  it("is valid, unique, sorted, and non-trivial", async () => {
    const contents = await readFile(listPath, "utf8");
    const domains = [...parseDomainList(contents)];

    expect(domains.length).toBeGreaterThan(25);
    expect(domains).toEqual([...domains].sort((left, right) => left.localeCompare(right)));
  });
});

