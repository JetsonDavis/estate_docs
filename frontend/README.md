# Estate Doc(tor) - Frontend

React TypeScript frontend for the Estate Doc(tor).

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
# .env file already created with defaults
# Edit if needed for different API URL
```

3. Start development server:
```bash
npm run dev
```

The app will be available at http://localhost:5173

## Development

```bash
# Run dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Code Quality

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Formatting
npm run format

# Run all checks
npm run check
```

## Project Structure

- `src/components/` - React components
  - `common/` - Reusable UI components
  - `layout/` - Layout components (Header, Sidebar)
  - `admin/` - Admin-specific components
  - `auth/` - Authentication components
  - `client/` - Client-facing components
- `src/pages/` - Page components
- `src/services/` - API service layer
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript type definitions
- `src/utils/` - Utility functions
