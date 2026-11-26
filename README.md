# RecipeShare

A small full-stack recipe sharing app that runs **entirely locally** — no cloud services, no external logins. React + Vite + TypeScript frontend, Express backend with SQLite, JWT auth, bcrypt password hashing, REST + GraphQL APIs, and local image uploads.

## Setup

```bash
npm install
npm run dev
```

That starts both servers together via `concurrently`:

- **Frontend:** http://localhost:5173 (Vite dev server, proxies `/api`, `/graphql`, `/uploads` to the backend)
- **Backend:** http://localhost:3001 (Express)

On first run the server creates `data/recipes.db`, seeds one admin account and 3 sample recipes.

## Admin login

| Field    | Value                   |
| -------- | ----------------------- |
| Email    | `admin@recipeshare.com` |
| Password | `admin123`              |

New signups are always created with the `user` role. Admins see an **admin** badge in the navbar and can delete any recipe; regular users can only delete their own.

## Features

- Email + password signup/login (bcrypt-hashed passwords, JWT sessions stored in `localStorage`)
- Roles: `admin` and `user`
- Recipe gallery grid, detail page, add/edit-recipe form (with photo upload), and "My recipes" page
- Uploaded images saved to `uploads/` and served statically at `/uploads/<file>`
- **REST API:** `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`, `GET /api/stats` (login required), `POST /api/recipes` (multipart image upload), `PUT|PATCH /api/recipes/:id`, `DELETE /api/recipes/:id`
- **GraphQL API** at `/graphql` (graphql-yoga): `listRecipes`, `createRecipe`, `updateRecipe`, `deleteRecipe` (login required)

## Project structure

```
RecipeShare/
├── index.html                    # Vite entry point
├── vite.config.ts                # Vite config: proxies /api, /graphql, /uploads to backend
├── package.json                  # Dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── eslint.config.js              # ESLint rules
├── .prettierrc                   # Prettier formatting rules
│
├── server/                       # Backend (Express + SQLite)
│   ├── index.js                  # Main Express server
│   │                             # - REST API routes (auth, recipes, stats)
│   │                             # - GraphQL schema and resolvers
│   │                             # - JWT authentication middleware
│   │                             # - Multer image upload handling
│   │                             # - Static file serving for uploads
│   └── db.js                     # SQLite database connection and schema
│                                 # - better-sqlite3 connection
│                                 # - Users and Recipes tables
│
├── src/                          # Frontend (React + TypeScript)
│   ├── main.tsx                  # React entry point
│   ├── App.tsx                   # Main app component
│   │                             # - React Router setup
│   │                             # - AuthProvider wrapper
│   │                             # - Route definitions for all pages
│   │
│   ├── api.ts                    # API client functions
│   │                             # - localStorage session management
│   │                             # - REST API calls (signup, login, recipes)
│   │                             # - GraphQL queries (listRecipes, deleteRecipe)
│   │
│   ├── auth.tsx                  # Authentication context
│   │                             # - AuthProvider component
│   │                             # - Session state management
│   │                             # - login/signup/logout functions
│   │
│   ├── types.ts                  # TypeScript interfaces
│   │                             # - User, Recipe, Stats types
│   │
│   ├── components/               # Reusable UI components
│   │   ├── Navbar.tsx            # Navigation bar with auth links
│   │   ├── ProtectedRoute.tsx    # Route guard for authenticated pages
│   │   └── RecipeLists.tsx       # Recipe grid component
│   │
│   ├── pages/                    # Page components
│   │   ├── LoginPage.tsx         # Login form
│   │   ├── SignupPage.tsx        # Signup form
│   │   ├── GalleryPage.tsx       # Recipe gallery (uses GraphQL)
│   │   ├── RecipeDetailPage.tsx  # Single recipe view
│   │   ├── AddRecipePage.tsx     # Add/edit recipe form (REST)
│   │   └── MyRecipesPage.tsx     # User's own recipes
│   │
│   └── styles.css                 # Global styles
│
├── uploads/                      # Uploaded recipe images (gitignored)
├── data/                         # Database files (gitignored)
│   └── recipes.db                # SQLite database file
└── dist/                         # Production build output (gitignored)
```

## Architecture & File Connections

### Frontend Flow
1. **Entry Point**: `main.tsx` → renders `App.tsx`
2. **App.tsx**: Sets up React Router, wraps everything in `AuthProvider`, includes `Navbar`
3. **Authentication**: `auth.tsx` provides `useAuth()` hook to all pages for login/signup/logout
4. **API Communication**: `api.ts` handles all HTTP requests to backend (REST + GraphQL)
5. **Pages**: Each page component uses `useAuth()` for auth state and functions from `api.ts` for data

### Backend Flow
1. **Server Entry**: `server/index.js` starts Express server on port 3001
2. **Database**: `server/db.js` establishes SQLite connection and defines schema
3. **REST Routes**:
   - `/api/auth/*` - signup, login, user verification (JWT + bcrypt)
   - `/api/recipes` - CRUD operations with image upload (multer)
   - `/api/stats` - app statistics
4. **GraphQL**: `/graphql` endpoint with schema for recipe operations
5. **Static Files**: `/uploads` serves uploaded images

### Data Flow Example (Login)
```
LoginPage.tsx → auth.tsx (login) → api.ts (login) → server/index.js (/api/auth/login)
→ db.js (user lookup) → bcrypt password check → JWT token generation
→ api.ts stores token in localStorage → auth.tsx updates user state
```

### Data Flow Example (View Recipes)
```
GalleryPage.tsx → api.ts (listRecipes) → GraphQL query to /graphql
→ server/index.js (GraphQL resolver) → db.js (SELECT from recipes)
→ Recipe data returned → GalleryPage displays via RecipeLists component
```

### Data Flow Example (Add Recipe)
```
AddRecipePage.tsx → api.ts (createRecipeForm) → POST /api/recipes with FormData
→ server/index.js (multer processes image upload) → db.js (INSERT into recipes)
→ Recipe data returned → Navigate to recipe detail page
```

## Scripts

| Command                | Description                  |
| ---------------------- | ---------------------------- |
| `npm run dev`          | Start frontend + backend     |
| `npm run build`        | Production build of frontend |
| `npm run lint`         | ESLint                       |
| `npm run format`       | Prettier write               |
| `npm run format:check` | Prettier check               |

## Configuration

Optional `.env` file (gitignored):

```
PORT=3001
JWT_SECRET=change-me
```
