# Blacklist policy

`domains.txt` is the API's source of truth. It is intentionally reviewed in Git rather than
downloaded from an untrusted source during a build or request.

## File format

- UTF-8 text with one lowercase canonical ASCII/Punycode domain per line.
- Alphabetical, with no duplicates, wildcards, URLs, ports, paths, or email addresses.
- Blank lines and lines starting with `#` are allowed.
- Matching includes subdomains: listing `example.com` also classifies `mx.example.com`.

## Classification standard

A domain belongs in the file when public evidence shows that it provides temporary or
disposable inboxes intended to receive mail without maintaining a normal long-lived mailbox.
Ordinary email services, privacy relays, forwarding services, public suffixes, and shared
infrastructure domains are excluded to limit false positives.

Every addition or removal should arrive through a pull request or the matching issue template
with enough evidence for another contributor to verify it. See [CONTRIBUTING.md](../CONTRIBUTING.md)
for the complete process.

## Validation

Run:

```bash
npm run validate:data
```

The test suite checks format, normalization, duplicates, sorting, and representative matches.
