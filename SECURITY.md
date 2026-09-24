# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |

## Reporting a Vulnerability

Do NOT open a public issue.

Email: security via GitHub private advisory, or contact maintainer via Telegram @llllxyz with subject "AgentMesh Security".

We will acknowledge within 48h and provide timeline.

## Threat Model

AgentMesh threat model includes:

- malicious agent, compromised agent, malicious Agent Card
- spoofed identity, replay, task hijacking, confused deputy
- SSRF, webhook abuse, authorization bypass, tenant breakout
- artifact access violations, message injection, oversized payloads
- DoS, retry storms, credential leakage, malicious extension, compromised gateway node

All controls must be implemented and tested.

## Security Controls (Phase 0+)

- No blind trust of remote Agent Cards
- SSRF protection for webhooks and discovery
- Signed webhooks with replay protection
- Tenant isolation via RLS + middleware
- Rate limiting per org/project/agent/skill/IP
- Artifact access control + presigned URLs
- No long-lived credential storage where possible
