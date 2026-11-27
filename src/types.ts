export interface User {
  cognito_sub: string;
  email: string;
  role: 'admin' | 'user';
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients?: string[];
  instructions?: string;
  category?: string;
  prepTime?: number;
  imageUrl?: string;
  authorId: string;
  authorName: string;
  createdAt: string;
}

export interface Stats {
  totalRecipes: number;
  categories: Record<string, number>;
}
