# Disposable Email Checker API

A small, community-maintained public API for checking whether an email domain is in an editable
blacklist. It runs on Cloudflare Workers, has no runtime package dependencies, normalizes
international domain names, and detects disposable providers used through subdomains.

You can deploy your own instance, propose blacklist changes, or adapt the project under the
[MIT License](LICENSE).

## Features

- One-command Cloudflare Workers deployment with the blacklist bundled as a text module.
- `GET` and privacy-friendlier `POST` checks for either an email address or domain.
- Exact and subdomain matching, including internationalized domains through Punycode.
- Native Cloudflare rate limiting, strict input limits, security headers, and configurable CORS.
- No database, outbound requests, accounts, secrets, application analytics, or application
  request logging.

## API

Check an email with GET:

```bash
curl "http://localhost:8787/v1/check?email=user%40mailinator.com"
```

Check a domain with POST (recommended when an email address is privacy-sensitive):

```bash
curl -X POST "http://localhost:8787/v1/check" \
  -H "Content-Type: application/json" \
  --data '{"domain":"mailinator.com"}'
```

Successful response:

```json
{
  "disposable": true
}
```

Successful checks return only the boolean classification and never echo the supplied email or
domain.

Provide exactly one `email` or `domain`. Invalid input is a `400`; oversized POST bodies are
`413`; unsupported content is `415`; and throttled requests are `429`. The deployed Worker
also exposes `GET /health` and an OpenAPI 3.1 document at `GET /openapi.json`.

This API validates conventional email syntax only far enough to safely extract a domain. It
does not query DNS, check MX records, send mail, or prove that a mailbox exists.

## Local development

Requirements: Node.js 20 or newer. A Cloudflare account is only needed for deployment.

```bash
npm install
npm run dev
```

Run all checks, including a Wrangler production bundle dry run:

```bash
npm run check
```

## Contribute to the blacklist

Edit [`data/domains.txt`](data/domains.txt). Keep one lowercase canonical domain per line,
in alphabetical order. Blank lines and lines beginning with `#` are ignored. A listed parent
also matches its subdomains, so `mailinator.com` covers `mx.mailinator.com`.

Before opening a pull request, read the [blacklist policy](data/README.md) and
[contribution guide](CONTRIBUTING.md). Add evidence that the domain provides temporary or
disposable mailboxes. Do not add ordinary email providers, privacy relays, shared hosting
domains, or a parent domain that would block legitimate subdomains. Imported lists must have
terms that allow redistribution in this MIT-licensed repository.

Validate changes with:

```bash
npm run validate:data
```

The included file is a complete, pinned snapshot of the CC0-licensed
`disposable-email-domains` blocklist with 7,936 entries. It is not downloaded or updated at
runtime. Production accuracy still depends on reviewing upstream changes, local additions,
removals, and false positives. The exact source commit and checksum are documented in the
[blacklist policy](data/README.md#upstream-snapshot).

## Public API protections

The Worker applies the following controls before it evaluates the blacklist:

- Cloudflare's native rate-limit binding: 100 check attempts per 60 seconds, per connecting
  IP and Cloudflare location. The binding is permissive/eventually consistent, so it is an
  abuse brake rather than an accounting mechanism.
- A 1 KiB POST body limit enforced while streaming, plus a 2 KiB URL limit.
- Strict route, method, query-field, JSON-shape, content-type, content-encoding, hostname,
  and conventional email-syntax validation.
- Generic errors that do not expose stack traces or source-list contents.
- Restrictive browser/security headers and configurable CORS.
- Persistent Workers invocation logging is disabled because it includes request URLs. POST avoids
  placing email addresses in URLs, and successful responses never echo any input.
- A fail-closed `503` response if the rate-limit binding is missing or unavailable.

The service has no database, outbound requests, secrets, or dynamic code execution. Cloudflare
provides network-level DDoS protection, but a heavily used deployment should still be monitored
and may need account-level WAF or bot rules.

### CORS

`ALLOWED_ORIGINS` is `*` by default because this is a public API. To restrict browser callers,
replace it in `wrangler.jsonc` with a comma-separated exact list such as:

```json
"ALLOWED_ORIGINS": "https://app.example.com,https://admin.example.com"
```

CORS is a browser control, not authentication; non-browser clients can supply arbitrary Origin
headers. Add a real API-key or token system if you later need caller identity or quotas.

## Deploy your own instance

1. Fork this repository, then clone your fork.
2. Install and verify it:

   ```bash
   npm ci
   npm run check
   ```

3. Give the Worker a unique `name` in `wrangler.jsonc`.
4. Change `ratelimits[0].namespace_id` if `1001` is already used by another rate limiter in your
   Cloudflare account. It must be a positive integer represented as a string.
5. Set `ALLOWED_ORIGINS` in `wrangler.jsonc` to `*` for a public browser API or to a
   comma-separated list of trusted web origins.
6. Authenticate once with `npx wrangler login`, then run `npm run deploy`.
7. Check the deployed `/health` endpoint and optionally attach a custom domain in Cloudflare.

The repository does not need Cloudflare credentials. Its GitHub Actions workflow only validates
pull requests and performs a local deployment dry run. If you later add automatic deployment,
store Cloudflare credentials in GitHub Actions secrets, never in the repository.

## Operating a public deployment

Use aggregate Cloudflare metrics to monitor `429` and `5xx` rates. Persistent invocation logging
is disabled in `wrangler.jsonc`; do not enable it without accounting for email addresses in GET
query strings and documenting the resulting retention. For a high-traffic instance, review
Cloudflare account limits and consider account-level WAF or bot-management rules.

The blacklist is bundled as a Wrangler Text module during deployment. Updating the file requires
a new Worker deployment; there is no runtime storage service or admin mutation endpoint to attack.

## Community and support

Use the issue templates to report a disposable domain, request removal of a false positive, or
report an API bug. Please use a private GitHub security advisory for vulnerabilities as described
in [SECURITY.md](SECURITY.md). By participating, you agree to the
[Code of Conduct](CODE_OF_CONDUCT.md).
