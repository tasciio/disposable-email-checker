const MAX_DOMAIN_LENGTH = 253;
const MAX_EMAIL_LENGTH = 254;
const MAX_LOCAL_PART_LENGTH = 64;
const ASCII_DOMAIN_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const EMAIL_LOCAL_PART = /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]+$/;
const FORBIDDEN_DOMAIN_CHARACTERS = /[\u0000-\u0020\u007f/@:\\?#\[\]%]/u;

/**
 * Converts a user-supplied hostname to canonical ASCII/Punycode form.
 * Returns null for IP addresses, single-label names, or invalid DNS names.
 */
export function normalizeDomain(value: string): string | null {
  let candidate = value.trim().toLowerCase();

  if (candidate.endsWith(".")) {
    candidate = candidate.slice(0, -1);
  }

  if (
    candidate.length === 0 ||
    candidate.length > MAX_DOMAIN_LENGTH ||
    candidate.includes("..") ||
    FORBIDDEN_DOMAIN_CHARACTERS.test(candidate) ||
    /^[0-9.]+$/.test(candidate)
  ) {
    return null;
  }

  let hostname: string;
  try {
    const parsed = new URL(`http://${candidate}`);
    if (
      parsed.username !== "" ||
      parsed.password !== "" ||
      parsed.port !== "" ||
      parsed.pathname !== "/" ||
      parsed.search !== "" ||
      parsed.hash !== ""
    ) {
      return null;
    }
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  if (
    hostname.length === 0 ||
    hostname.length > MAX_DOMAIN_LENGTH ||
    /^[0-9.]+$/.test(hostname)
  ) {
    return null;
  }

  const labels = hostname.split(".");
  const topLevelDomain = labels.at(-1);
  if (
    labels.length < 2 ||
    topLevelDomain === undefined ||
    topLevelDomain.length < 2 ||
    /^\d+$/.test(topLevelDomain) ||
    labels.some((label) => !ASCII_DOMAIN_LABEL.test(label))
  ) {
    return null;
  }

  return hostname;
}

/** Extracts and validates the domain from a conventional, unquoted email address. */
export function domainFromEmail(value: string): string | null {
  const email = value.trim();
  const atIndex = email.indexOf("@");

  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    atIndex <= 0 ||
    atIndex !== email.lastIndexOf("@")
  ) {
    return null;
  }

  const localPart = email.slice(0, atIndex);
  if (
    localPart.length > MAX_LOCAL_PART_LENGTH ||
    localPart.startsWith(".") ||
    localPart.endsWith(".") ||
    localPart.includes("..") ||
    !EMAIL_LOCAL_PART.test(localPart)
  ) {
    return null;
  }

  const domain = normalizeDomain(email.slice(atIndex + 1));
  if (domain === null || localPart.length + 1 + domain.length > MAX_EMAIL_LENGTH) {
    return null;
  }

  return domain;
}

/** Parses the deployed text module and fails fast if a maintained entry is invalid. */
export function parseDomainList(contents: string): ReadonlySet<string> {
  const domains = new Set<string>();

  contents.split(/\r?\n/u).forEach((rawLine, index) => {
    const entry = rawLine.split("#", 1)[0]?.trim() ?? "";
    if (entry === "") {
      return;
    }

    const normalized = normalizeDomain(entry);
    if (normalized === null || normalized !== entry) {
      throw new Error(`Invalid or non-canonical blacklist domain on line ${index + 1}`);
    }
    if (domains.has(normalized)) {
      throw new Error(`Duplicate blacklist domain on line ${index + 1}`);
    }
    domains.add(normalized);
  });

  if (domains.size === 0) {
    throw new Error("The disposable-domain blacklist is empty");
  }

  return domains;
}

/** Returns whether the exact domain or one of its parent domains is blacklisted. */
export function isDisposableDomain(
  domain: string,
  blacklist: ReadonlySet<string>,
): boolean {
  const labels = domain.split(".");

  for (let index = 0; index < labels.length - 1; index += 1) {
    const candidate = labels.slice(index).join(".");
    if (blacklist.has(candidate)) {
      return true;
    }
  }

  return false;
}
