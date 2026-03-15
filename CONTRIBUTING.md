# Contributing to Sentinel

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Prerequisites:** Node.js >= 22, pnpm 9.15.4
2. Clone the repo and install dependencies:

```bash
git clone https://github.com/essandhu/Sentinel.git
cd Sentinel
pnpm install
```

3. Build all packages:

```bash
pnpm build
```

4. Run tests:

```bash
pnpm test
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add or update tests as needed
4. Run `pnpm test` and `pnpm typecheck` to verify
5. Open a pull request against `main`

## Project Structure

This is a Turborepo monorepo. See the [README](README.md#project-structure) for a map of packages and apps.

## Code Style

- TypeScript throughout
- Tests live alongside source files (`*.test.ts`) or in `__tests__/` directories
- Vitest for unit/integration tests, Playwright for e2e

## Reporting Issues

Open an issue on GitHub with steps to reproduce. Include your Node.js version, OS, and any relevant config.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
