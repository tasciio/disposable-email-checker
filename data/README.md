# Blacklist policy

`domains.txt` is the API's source of truth. It is intentionally reviewed in Git rather than
downloaded from an untrusted source during a build or request.

## Upstream snapshot

`domains.txt` contains the complete
[`disposable-email-domains`](https://github.com/disposable-email-domains/disposable-email-domains)
blocklist from this pinned snapshot:

- Commit:
  [`66c137dc670a0981cec1557b11b27b8c7f572502`](https://github.com/disposable-email-domains/disposable-email-domains/commit/66c137dc670a0981cec1557b11b27b8c7f572502)
- Imported: 2026-07-17
- Entries: 7,936
- SHA-256: `6812426525ad0b60e53104f47065f3fde0b7af48a85a3cbecb1f7e03a49e524e`
- License:
  [CC0 1.0](https://github.com/disposable-email-domains/disposable-email-domains/blob/66c137dc670a0981cec1557b11b27b8c7f572502/LICENSE.txt)

The upstream data is dedicated to the public domain and can be redistributed here. The Worker
uses this checked-in snapshot and never downloads data during a build or request.

## Local changes

- `luckfeed.com` was added locally on 2026-07-17 by maintainer request.
- `gwshare.com` and `practoso.com` were added locally on 2026-07-25 by maintainer request.
- `inboxly.website` was added locally on 2026-07-25 by maintainer request.

The deployed `domains.txt`, including local changes, contains 7,940 entries and has SHA-256
`bb822ea30ce6d74be4f9c8dd609a1990cebcef50577aeb37a696c52200b65dfc`.

## File format

- UTF-8 text with one lowercase canonical ASCII/Punycode domain per line.
- Alphabetical, with no duplicates, wildcards, URLs, ports, paths, or email addresses.
- Blank lines and lines starting with `#` are allowed.
- Matching includes subdomains: listing `example.com` also classifies `mx.example.com`.

## Classification standard

A domain belongs in the file when the pinned upstream snapshot or public evidence identifies it
as providing temporary or disposable inboxes. Ordinary email services, privacy relays, public
suffixes, and shared infrastructure domains should be removed when evidence shows that listing
them creates false positives.

Bulk upstream snapshots cannot guarantee permanent accuracy. Every local addition or removal
should arrive through a pull request or the matching issue template with enough evidence for
another contributor to verify it. See [CONTRIBUTING.md](../CONTRIBUTING.md) for the complete
process.

## Updating the upstream snapshot

1. Select and record a specific upstream commit; never import from a moving branch reference.
2. Confirm that the upstream license still permits redistribution.
3. Replace `domains.txt` with the complete file from that commit and review the diff, preserving
   intentional local additions and removals.
4. Update the upstream metadata, local-change record, deployed entry count, and SHA-256 above.
5. Update the snapshot assertions in `test/domain-list.test.ts` and run `npm run check`.

## Validation

Run:

```bash
npm run validate:data
```

The test suite checks the pinned snapshot checksum and entry count as well as format,
normalization, duplicates, sorting, and representative matches.
