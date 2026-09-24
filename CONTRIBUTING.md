# Contributing to AgentMesh

Thanks for your interest in contributing.

## Principles

- Real problems, small, runnable, tested.
- No AI slop: simple, natural, professional code. If you can't defend it with your own words, don't submit it.
- Control Plane / Data Plane separation must be respected.
- A2A is first-class, no proprietary replacement.
- Security controls are implemented, not just documented.

## Development Setup

1. Node 20+, pnpm 9+
2. `pnpm install`
3. `pnpm docker:up`
4. `cp infra/.env.example .env`
5. `pnpm dev`

## Workflow

1. Open an issue or pick an existing one.
2. Create a feature branch: `feat/xxx` or `fix/xxx`
3. Implement with tests.
4. Run `pnpm lint && pnpm typecheck && pnpm test`
5. Open PR against `main` with clear description, reproduction, and test evidence.

## Code Style

- TypeScript strict mode.
- No heavy abstractions for demo purposes.
- Use Zod for validation at boundaries.
- OTel tracing for any task/message flow.

## Security

If you find a security issue, follow SECURITY.md — do not open a public issue.

## License

By contributing, you agree that your contributions will be licensed under Apache 2.0.
