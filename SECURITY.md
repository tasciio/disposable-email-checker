# Security policy

Please report suspected vulnerabilities with a private GitHub security advisory if this
repository is hosted on GitHub. Do not include real email addresses, API tokens, or other
personal data in reports. If private advisories are not enabled, contact the repository
owner privately before opening a public issue.

The service intentionally has no API keys or user accounts. It returns only normalized
domain data and never logs request inputs in application code. Cloudflare platform logs
and analytics should also be configured to avoid storing full request URLs if email query
parameters may contain personal data; privacy-sensitive clients should use the POST route.

The blacklist is a classification aid, not a security boundary. Callers must not treat a
negative result as proof that an address or mailbox is trustworthy.

