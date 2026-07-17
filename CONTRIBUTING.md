# Contributing

Thanks for helping improve the checker. Small, evidence-based pull requests are easiest to
review. Please do not submit private email addresses, access tokens, or other personal data.

## Blacklist additions

Add a domain only when it directly provides temporary or disposable mailboxes. A submission
should include public evidence, such as the provider's website or documentation, in the pull
request or disposable-domain issue.

- Add one lowercase ASCII/Punycode domain per line to `data/domains.txt` and keep the file sorted.
- Add the narrowest domain that identifies the service. A listed parent matches every subdomain.
- Do not add ordinary mailbox providers, privacy or forwarding relays, shared hosting domains,
  public suffixes, IP addresses, URLs, email addresses, or wildcard entries.
- Check whether the provider uses additional active domains and submit them with evidence.
- If copying from an external list, identify its source and license. The license must allow
  redistribution here under this repository's MIT license.

Run `npm run validate:data` before submitting. The automated test rejects duplicates, invalid
domains, non-canonical entries, and incorrect sorting.

## Upstream snapshot updates

The deployed list is a complete, pinned snapshot of the CC0-licensed
`disposable-email-domains` project plus any reviewed local changes. Snapshot updates must use a
specific upstream commit, include the complete upstream file, preserve intentional local changes,
and update the provenance metadata and snapshot assertions in `data/README.md` and
`test/domain-list.test.ts`. Review the complete diff for likely false positives before submitting.

## False positives and removals

Open the false-positive issue template and explain the legitimate use of the domain. Evidence
that a temporary-mail site is currently offline is not, by itself, enough for removal because
domains can be reactivated or transferred. Maintainers will consider current ownership,
legitimate mailbox use, and the risk of blocking subdomains.

## Code and API changes

1. Open an issue first for substantial behavior or API-contract changes.
2. Keep changes focused and avoid adding runtime dependencies without a clear need.
3. Add or update tests for behavior changes.
4. Run `npm ci` and `npm run check`.
5. Update the README and OpenAPI document if public behavior changes.

## Pull requests

Complete the pull request checklist and explain what changed and why. By submitting a
contribution, you agree that it may be distributed under the [MIT License](LICENSE). All
participants must follow the [Code of Conduct](CODE_OF_CONDUCT.md).
