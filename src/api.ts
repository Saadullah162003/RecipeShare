import type { Recipe, Stats, User } from './types';

const TOKEN_KEY = 'recipeshare_token';
const USER_KEY = 'recipeshare_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export function storeSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export async function signup(email: string, password: string) {
  const res = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await handle<{ token: string; user: User }>(res);
  storeSession(data.token, data.user);
  return data.user;
}

export async function login(email: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await handle<{ token: string; user: User }>(res);
  storeSession(data.token, data.user);
  return data.user;
}

export async function logout() {
  clearSession();
}

export async function fetchMe(): Promise<User> {
  const res = await fetch('/api/auth/me', { headers: await authHeaders() });
  const data = await handle<{ user: User }>(res);
  return data.user;
}

export async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/stats', { headers: await authHeaders() });
  return handle<Stats>(res);
}

export async function createRecipeForm(
  title: string,
  ingredients: string,
  steps: string,
  image: File | null,
): Promise<Recipe> {
  const form = new FormData();
  form.append('title', title);
  form.append('ingredients', ingredients);
  form.append('steps', steps);
  if (image) form.append('image', image);
  const res = await fetch('/api/recipes', {
    method: 'POST',
    headers: await authHeaders(),
    body: form,
  });
  return handle<Recipe>(res);
}

export async function updateRecipeForm(
  id: number,
  title: string,
  ingredients: string,
  steps: string,
  image: File | null,
  removeImage = false,
): Promise<Recipe> {
  const form = new FormData();
  form.append('title', title);
  form.append('ingredients', ingredients);
  form.append('steps', steps);
  if (image) form.append('image', image);
  if (removeImage && !image) form.append('removeImage', 'true');
  const res = await fetch(`/api/recipes/${id}`, {
    method: 'PUT',
    headers: await authHeaders(),
    body: form,
  });
  return handle<Recipe>(res);
}

const LIST_RECIPES = /* GraphQL */ `
  query {
    listRecipes {
      id
      title
      ingredients
      steps
      image
      ownerId
      ownerEmail
      createdAt
    }
  }
`;

const DELETE_RECIPE = /* GraphQL */ `
  mutation DeleteRecipe($id: Int!) {
    deleteRecipe(id: $id)
  }
`;

async function graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch('/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data as T;
}

export async function listRecipes(): Promise<Recipe[]> {
  const data = await graphql<{ listRecipes: Recipe[] }>(LIST_RECIPES);
  return data.listRecipes;
}

export async function deleteRecipe(id: number): Promise<void> {
  await graphql<{ deleteRecipe: boolean }>(DELETE_RECIPE, { id });
}
