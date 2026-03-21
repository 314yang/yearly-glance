# AGENTS.md - Yearly Glance Development Guide

This file provides guidelines and commands for AI agents working on this codebase.

## Project Overview

**Yearly Glance** is an Obsidian plugin that provides a yearly overview calendar with customizable events, holidays, birthdays, and more. It supports both Gregorian and Chinese lunar calendars.

- **Type**: Obsidian Plugin (TypeScript + React)
- **Main entry**: `src/main.ts`
- **Node requirement**: >=18.x

## Build Commands

```bash
# Install dependencies
npm install

# Development build (with watch)
npm run dev

# Production build
npm run build

# Build and copy to local vault for testing
npm run build:local

# TypeScript type checking only
tsc -noEmit -skipLibCheck
```

### Linting

```bash
# Run linter
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run a single test file
npx jest test/holidayService.test.ts

# Run a single test (using jest -t flag)
npx jest --testNamePattern="测试1" test/holidayService.test.ts
```

### Release Commands

```bash
# Version bump
npm run version

# Generate changelog
npm run changelog:u

# Full release process
npm run release:pre
```

### Makefile Targets

```bash
# Release stable version
make release v=1.0.0

# Release beta version
make beta v=1.0.0-beta.1

# Delete a version
make del v=1.0.0
```

## Code Style Guidelines

### General

- Use **tabs** for indentation (set `tab_width = 4` in your editor)
- Use **UTF-8** charset with **LF** line endings
- Always end files with a newline
- TypeScript strict mode is enabled (`strictNullChecks: true`)

### TypeScript

- Use TypeScript for all new code
- Use `interface` for object shapes, `type` for unions/primitives
- Avoid `any` type - prefer `unknown` or proper type guards
- Use path aliases: `@/*` maps to project root (e.g., `@/src/type/Events`)
- Enable `forceConsistentCasingInFileNames: true`
- Prefer `const` over `let`, avoid `var`
- Use optional chaining (`?.`) and nullish coalescing (`??`) when appropriate

### Imports

Follow this import order (enforced by ESLint):
1. Side-effect imports (e.g., `import "./style.css"`)
2. External libraries (e.g., `obsidian`, `react`)
3. Internal modules (e.g., `@/src/type/Events`)
4. Relative imports (e.g., `./utils/dateValidator`)

```typescript
// External
import * as React from "react";
import { Notice, Plugin } from "obsidian";

// Path alias
import { Birthday, CustomEvent, EventType, Holiday } from "@/src/type/Events";

// Relative
import { IsoUtils } from "../utils/isoUtils";
```

### Naming Conventions

- **Classes/Types/Interfaces**: PascalCase (`YearlyGlanceConfig`)
- **Functions/Variables**: camelCase (`generateEventId`, `isFirstInstall`)
- **Constants**: SCREAMING_SNAKE_CASE for true constants (`HOLIDAY_EMOJI`)
- **Component files**: PascalCase (`.tsx` files for React components)
- **Service files**: PascalCase with `Service` suffix
- **Type files**: PascalCase in `type/` directory
- **Test files**: Match source file name with `.test.ts` suffix

### React Components

- Use functional components with `React.FC<Props>` type
- Destructure props with default values
- Use `React.useCallback` for callbacks passed to child components
- Use `React.memo` for pure components that receive stable references

```typescript
interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline" | "danger";
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  disabled = false,
  variant = "primary",
}) => {
  // implementation
};
```

### Error Handling

- Use descriptive error messages
- For user-facing errors, use `t()` for i18n translation keys
- Wrap async operations in try-catch blocks
- Use type guards for runtime type checking

```typescript
try {
  const data = JSON.parse(input);
} catch (error) {
  console.error("[yearly-glance] Data parsing failed", error);
}
```

### CSS/Styling

- Component-specific CSS files go in `components/*/style/*.css`
- Use BEM-like naming: `.yg-button`, `.yg-button--primary`
- Use CSS nesting (postcss-nesting is configured)
- Prefer CSS custom properties for theming

### File Organization

```
src/
├── components/      # React UI components
│   ├── Base/        # Reusable base components
│   ├── Settings/    # Settings-related components
│   └── ...
├── context/         # React context providers
├── hooks/           # Custom React hooks
├── i18n/            # Internationalization
├── service/         # Business logic services
├── type/            # TypeScript type definitions
├── utils/           # Utility functions
├── views/           # Main view components
└── main.ts          # Plugin entry point
```

### Obsidian-Specific

- Plugin class extends `Plugin` from obsidian
- Views must be registered with `registerView()`
- Settings should persist via `saveData()` / `loadData()`
- Use `Notice` for user notifications
- Use `@ts-ignore` sparingly for obsidian type issues

### Comments

- Use JSDoc for public functions and complex logic
- Use Chinese comments for internal logic (matches codebase convention)
- Avoid unnecessary comments - code should be self-documenting

```typescript
/**
 * Updates all events' dateArr fields
 * Called on: plugin load, year change, toggle holidays, import data, CRUD events
 */
public async updateAllEventsDateObj() {
  // implementation
}
```

## Testing Guidelines

- Tests go in `test/` directory with `.test.ts` suffix
- Use Jest with `ts-jest` preset
- Group related tests with `describe()` blocks
- Use `it()` or `test()` for individual test cases
- Matchers: `toBe()`, `toEqual()`, `toBeGreaterThan()`, `toContain()`

```typescript
describe("HolidayService", () => {
  it("should fetch public holidays", () => {
    const holidays = HolidayService.getPublicHolidays(2025);
    expect(holidays.length).toBeGreaterThan(0);
  });
});
```

## ESLint Rules

The project uses TypeScript ESLint with these key rules:
- `@typescript-eslint/no-unused-vars`: Error on unused args (not variables)
- `@typescript-eslint/ban-ts-comment`: Off (allows `@ts-ignore`)
- `sort-imports`: Enforces import ordering
- `no-mixed-spaces-and-tabs`: Off (tabs are used)

## Git/Commit Conventions

Use Conventional Commits:
```
<type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, perf, test, chore
```

Example:
```
feat(event-form): add lunar calendar date support
fix(holiday): correct double holiday display
```

Use `npx cz` for guided commit messages.

## Additional Notes

- The `.env` file should point to your vault path for local testing
- Build output goes to `manifest.json` and bundled JS
- The plugin uses `lunar-typescript` for Chinese lunar calendar support
- Icons are from `lucide-react`
