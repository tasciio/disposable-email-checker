# Disposable Email Checker API

A free, community-maintained API that checks whether an email domain appears in a disposable-email blocklist. It runs on Cloudflare Workers and supports exact domains, subdomains, and internationalized domains.

**Live API:** [https://disposable-email-checker.tasciio.workers.dev](https://disposable-email-checker.tasciio.workers.dev)

No API key is required. The public deployment is rate-limited and provided without an uptime guarantee.

## Examples

Check a disposable domain:

```bash
curl "https://disposable-email-checker.tasciio.workers.dev/v1/check?domain=mailinator.com"
```

```json
{"disposable":true}
```

Check an ordinary provider:

```bash
curl "https://disposable-email-checker.tasciio.workers.dev/v1/check?domain=gmail.com"
```

```json
{"disposable":false}
```

Use `POST` when checking a full email address so it does not appear in the URL:

```bash
curl -X POST "https://disposable-email-checker.tasciio.workers.dev/v1/check" \
  -H "Content-Type: application/json" \
  --data '{"email":"user@mailinator.com"}'
```

JavaScript example:

```js
const response = await fetch(
  "https://disposable-email-checker.tasciio.workers.dev/v1/check",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain: "mailinator.com" }),
  },
);

const { disposable } = await response.json();
console.log(disposable); // true
```

## API

`GET /v1/check` accepts exactly one `email` or `domain` query parameter. `POST /v1/check` accepts exactly one of them in a JSON object. Successful requests return only:

```json
{"disposable":true}
```

Other public endpoints:

- [`GET /health`](https://disposable-email-checker.tasciio.workers.dev/health)
- [`GET /openapi.json`](https://disposable-email-checker.tasciio.workers.dev/openapi.json)

Invalid input returns `400`, oversized bodies return `413`, unsupported content returns `415`, and throttled requests return `429`.

This service classifies domains only. It does not query DNS or MX records, verify a mailbox, or send email.

## Run locally

Requires Node.js 20 or newer:

```bash
npm install
npm run dev
```

Run the type checker, tests, and Wrangler deployment dry run:

```bash
npm run check
```

## Deploy your own

1. Fork and clone the repository.
2. Run `npm ci` and `npm run check`.
3. Give the Worker a unique `name` in `wrangler.jsonc`.
4. Configure `ALLOWED_ORIGINS` and a unique positive `ratelimits[0].namespace_id`.
5. Run `npx wrangler login`, followed by `npm run deploy`.

The blocklist is bundled into the Worker, so blocklist changes require a new deployment.

The included GitHub Actions workflow automatically validates and deploys whenever `data/domains.txt` changes on `main`. Add `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` as repository Actions secrets. Create the token from Cloudflare's **Edit Cloudflare Workers** template and restrict it to the deployment account.

## Update the blocklist

Edit [`data/domains.txt`](data/domains.txt), keeping one lowercase canonical domain per line in alphabetical order, then run:

```bash
npm run validate:data
```

A listed parent covers its subdomains. Include evidence that additions provide temporary or disposable mailboxes, and do not add ordinary email providers, privacy relays, or shared hosting domains. See the [blocklist policy and upstream attribution](data/README.md) before opening a pull request.

## Privacy and security

The Worker has no database, accounts, secrets, outbound requests, application analytics, or persistent invocation logging. It applies input limits, security headers, configurable CORS, and Cloudflare-native rate limiting. Prefer `POST` for full email addresses because URLs can appear in infrastructure logs.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contributions and [SECURITY.md](SECURITY.md) for private vulnerability reports. Released under the [MIT License](LICENSE).
