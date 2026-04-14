# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do not** create a public GitHub issue.
2. Email the maintainer directly at: [tanishqkatiyar@email.com]
3. Include a detailed description of the vulnerability and steps to reproduce.
4. Allow 48 hours for an initial response.

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅        |

## Security Measures

This project implements multiple layers of security:

- **Server-side API keys** — All secrets are server-only, never exposed to the browser
- **Rate limiting** — Per-IP sliding-window limiters on every public endpoint
- **Input sanitization** — XSS prevention, max-length enforcement, email validation
- **Auth hardening** — httpOnly cookies, timing-safe comparison, brute-force protection
- **Security headers** — HSTS, X-Frame-Options, CSP, X-Content-Type-Options
- **Generic error messages** — Internal errors are logged but never sent to clients
