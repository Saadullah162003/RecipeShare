import { generateClient, get } from 'aws-amplify/api';
import { uploadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Recipe, Stats } from './types';

const client = generateClient();

// 1. Upload image directly to S3 and return public URL
export async function uploadRecipeImage(file: File): Promise<string> {
  const key = `recipes/${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
  await uploadData({
    path: key,
    data: file,
    options: { contentType: file.type },
  }).result;

  const bucket = import.meta.env.VITE_S3_BUCKET;
  const region = import.meta.env.VITE_AWS_REGION;
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// 2. AppSync GraphQL Queries & Mutations
export async function fetchRecipes(): Promise<Recipe[]> {
  const res: any = await client.graphql({
    query: `
      query ListRecipes {
        listRecipes {
          id title description ingredients instructions category prepTime imageUrl authorId authorName createdAt
        }
      }
    `,
  });
  return res.data.listRecipes || [];
}

export async function getRecipe(id: string): Promise<Recipe> {
  const res: any = await client.graphql({
    query: `
      query GetRecipe($id: ID!) {
        getRecipe(id: $id) {
          id title description ingredients instructions category prepTime imageUrl authorId authorName createdAt
        }
      }
    `,
    variables: { id },
  });
  return res.data.getRecipe;
}

export async function createRecipe(input: any): Promise<Recipe> {
  const res: any = await client.graphql({
    query: `
      mutation CreateRecipe($input: CreateRecipeInput!) {
        createRecipe(input: $input) {
          id title description ingredients instructions category prepTime imageUrl authorId authorName createdAt
        }
      }
    `,
    variables: { input },
  });
  return res.data.createRecipe;
}

export async function updateRecipe(input: any): Promise<Recipe> {
  const res: any = await client.graphql({
    query: `
      mutation UpdateRecipe($input: UpdateRecipeInput!) {
        updateRecipe(input: $input) {
          id title description ingredients instructions category prepTime imageUrl authorId authorName createdAt
        }
      }
    `,
    variables: { input },
  });
  return res.data.updateRecipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  await client.graphql({
    query: `
      mutation DeleteRecipe($id: ID!) {
        deleteRecipe(id: $id) { id }
      }
    `,
    variables: { id },
  });
}

// 3. API Gateway REST endpoint (/stats) with Cognito JWT token
export async function fetchStats(): Promise<Stats> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() || '';

  const restOp = get({
    apiName: 'RecipeShareREST',
    path: '/stats',
    options: {
      headers: { Authorization: token },
    },
  });
  const { body } = await restOp.response;
  return await body.json();
}
