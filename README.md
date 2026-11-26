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
├── index.html               # Vite entry
├── vite.config.ts           # dev proxy for /api, /graphql, /uploads
├── server/
│   ├── index.js             # Express app: REST routes, auth, uploads, GraphQL
│   └── db.js                # better-sqlite3 connection + schema
├── src/
│   ├── api.ts               # REST + GraphQL client
│   ├── auth.tsx             # auth context / session state
│   ├── types.ts
│   ├── App.tsx              # router + providers
│   ├── components/          # Navbar, ProtectedRoute
│   ├── pages/               # Login, Signup, Gallery, Detail, Add, MyRecipes
│   └── styles.css
├── uploads/                 # uploaded recipe photos (gitignored)
└── data/recipes.db          # SQLite database (gitignored)
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
