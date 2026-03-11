# Testing Guide

## Why the styled-components Error Wasn't Caught

The styled-components v6 / @types/styled-components v5 conflict that caused the `$flash` prop error wasn't caught by existing tests because:

1. **No Unit Tests for QuestionGroups**: Only e2e tests existed, which test the full application flow but don't catch component-level rendering errors during development.

2. **Runtime-Only Error**: The error only manifests when the component actually renders in a browser with the conflicting type definitions. TypeScript compilation succeeded because the types were technically valid, but the runtime behavior was broken.

3. **Build Process Doesn't Catch Runtime Errors**: The `npm run build` command only checks TypeScript types and bundles the code - it doesn't execute the components to catch runtime styled-components errors.

## How to Prevent Similar Issues

### 1. Run Pre-Deployment Checks

Before deploying or building Docker images, always run:

```bash
npm run pre-deploy
```

This runs both type-checking and a full build to catch compilation errors.

### 2. Keep Dependencies in Sync

When upgrading major versions of libraries like styled-components:

- **Remove conflicting type packages**: styled-components v6+ has built-in TypeScript support, so `@types/styled-components` should be removed
- **Check peer dependencies**: Run `npm ls styled-components` to see if any packages depend on incompatible versions
- **Test locally before deploying**: Always test the production build locally with `npm run build && npm run preview`

### 3. Type-Check Regularly

Run type-checking as part of your development workflow:

```bash
npm run type-check
```

This catches TypeScript errors without needing to build the full application.

### 4. Add Component Smoke Tests

The `QuestionGroups.smoke.test.ts` file ensures the component can be imported and type-checked. Add similar smoke tests for other critical components.

### 5. E2E Tests

Run e2e tests before deployment:

```bash
npm run test:e2e
```

These tests catch runtime errors by actually rendering the application in a browser.

## Testing Commands

| Command | Purpose | When to Run |
|---------|---------|-------------|
| `npm run type-check` | TypeScript type checking | Before commits, in CI/CD |
| `npm run lint` | Code quality checks | Before commits |
| `npm run check` | Type-check + lint | Before commits |
| `npm run build` | Production build | Before deployment |
| `npm run pre-deploy` | Type-check + build | **Before every deployment** |
| `npm run test:e2e` | End-to-end tests | Before deployment, in CI/CD |

## CI/CD Integration

Add this to your deployment workflow:

```bash
# Before building Docker image
cd frontend
npm ci
npm run pre-deploy
cd ..

# Then build and push Docker image
docker build --platform linux/amd64 -t jetsondavis/estate-doctor:amd .
docker push jetsondavis/estate-doctor:amd
```

## Dependency Management Best Practices

1. **Lock file**: Always commit `package-lock.json` to ensure consistent installs
2. **Audit regularly**: Run `npm audit` to check for security vulnerabilities
3. **Update carefully**: Test thoroughly when updating major versions
4. **Document breaking changes**: Note any dependency changes in commit messages

## Common Issues

### styled-components Version Conflicts

**Symptom**: Runtime errors about transient props (`$propName`)

**Solution**: 
- Remove `@types/styled-components` if using styled-components v6+
- Ensure no other packages depend on older styled-components versions

### import.meta.env Errors in Tests

**Symptom**: `Cannot use 'import.meta' outside a module` in Jest tests

**Solution**: 
- Mock the API client in tests instead of trying to mock import.meta
- Use smoke tests for type-checking instead of full Jest unit tests
- Consider Vitest instead of Jest for better Vite compatibility
