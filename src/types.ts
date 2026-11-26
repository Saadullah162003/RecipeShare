export interface User {
  id: number;
  email: string;
  role: 'admin' | 'user';
}

export interface Recipe {
  id: number;
  title: string;
  ingredients: string;
  steps: string;
  image: string | null;
  ownerId: number;
  ownerEmail: string | null;
  createdAt: string;
}

export interface Stats {
  recipeCount: number;
  latestRecipeTitle: string | null;
}
