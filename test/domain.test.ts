import { describe, expect, it } from "vitest";
import {
  checkDomain,
  domainFromEmail,
  normalizeDomain,
  parseDomainList,
} from "../src/domain";

describe("domain normalization", () => {
  it("normalizes case, whitespace, a trailing dot, and international domains", () => {
    expect(normalizeDomain("  MAIL.Example.COM. ")).toBe("mail.example.com");
    expect(normalizeDomain("bücher.example")).toBe("xn--bcher-kva.example");
  });

  it.each([
    "localhost",
    "127.0.0.1",
    "[::1]",
    "bad..example",
    "-bad.example",
    "bad_.example",
    "example.1",
    "user@example.com",
    "https://example.com",
  ])("rejects invalid or non-public domain %s", (value) => {
    expect(normalizeDomain(value)).toBeNull();
  });
});

describe("email parsing", () => {
  it("accepts conventional addresses", () => {
    expect(domainFromEmail("First.Last+tag@MAILINATOR.COM")).toBe("mailinator.com");
  });

  it.each([
    "missing-at.example",
    "two@@example.com",
    ".leading@example.com",
    "trailing.@example.com",
    "two..dots@example.com",
    "spaces are@bad.example",
  ])("rejects invalid address %s", (value) => {
    expect(domainFromEmail(value)).toBeNull();
  });
});

describe("blacklist", () => {
  const blacklist = new Set(["mailinator.com", "yopmail.com"]);

  it("matches exact entries and their subdomains", () => {
    expect(checkDomain("mailinator.com", blacklist)).toEqual({
      domain: "mailinator.com",
      disposable: true,
      matchedDomain: "mailinator.com",
    });
    expect(checkDomain("mx.eu.mailinator.com", blacklist)).toEqual({
      domain: "mx.eu.mailinator.com",
      disposable: true,
      matchedDomain: "mailinator.com",
    });
  });

  it("does not suffix-match unrelated domains", () => {
    expect(checkDomain("notmailinator.com", blacklist).disposable).toBe(false);
  });

  it("validates maintained list entries", () => {
    expect(parseDomainList("# comment\nmailinator.com\nyopmail.com\n").size).toBe(2);
    expect(() => parseDomainList("MAILINATOR.COM\n")).toThrow(/non-canonical/u);
    expect(() => parseDomainList("mailinator.com\nmailinator.com\n")).toThrow(/Duplicate/u);
    expect(() => parseDomainList("\n# only comments\n")).toThrow(/empty/u);
  });
});

