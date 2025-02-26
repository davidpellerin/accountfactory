# AccountFactory Development Guide

## Commands
- Build: N/A (JavaScript)
- Test: `npm test` (all tests) or `npm test -- -t "test name"` (single test)
- Test with coverage: `npm run test:coverage`
- Lint: `npm run lint` (check) or `npm run lint:fix` (auto-fix)
- Format: `npm run format` (fix) or `npm run format:check` (check only)

## Code Style
- **Imports**: ES modules (`import/export`), sorted alphabetically
- **Formatting**: Prettier with 100 char line length, 2 space indent, single quotes
- **Errors**: Use explicit error handling with try/catch, propagate with context
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Types**: Use JSDoc comments for type documentation
- **Testing**: Jest with descriptive test names, mock AWS services with aws-sdk-client-mock
- **Error handling**: Use try/catch with informative error messages
- **Classes**: Prefer singleton pattern with exported instances
- **AWS SDK**: Use v3 client structure with command pattern
- **Logging**: Use the logger utility with appropriate log levels (debug, info, success, warning, error)

## Unit Test Standards
- Test files next to source files with `.test.js` extension
- Reset mocks in `beforeEach`
- Test names: "should X when Y"
- Use top-level mocks with client.reset()