import { generateClient, get } from 'aws-amplify/api';
import { uploadData } from 'aws-amplify/storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Recipe, Stats } from './types';

const client = generateClient();

const RECIPE_FIELDS = `
  id title description ingredients instructions category prepTime imageUrl authorId authorName createdAt
`;

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

export async function fetchRecipes(): Promise<Recipe[]> {
  const res: any = await client.graphql({
    query: `query ListRecipes { listRecipes { ${RECIPE_FIELDS} } }`,
    authMode: 'apiKey',
  });
  return res.data.listRecipes || [];
}

export async function getRecipe(id: string): Promise<Recipe> {
  const res: any = await client.graphql({
    query: `query GetRecipe($id: ID!) { getRecipe(id: $id) { ${RECIPE_FIELDS} } }`,
    variables: { id },
    authMode: 'apiKey',
  });
  return res.data.getRecipe;
}

export async function createRecipe(input: any): Promise<Recipe> {
  const res: any = await client.graphql({
    query: `mutation CreateRecipe($input: CreateRecipeInput!) { createRecipe(input: $input) { ${RECIPE_FIELDS} } }`,
    variables: { input },
    authMode: 'userPool',
  });
  return res.data.createRecipe;
}

export async function updateRecipe(input: any): Promise<Recipe> {
  const sanitizedInput = {
    id: input.id,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.ingredients !== undefined && { ingredients: input.ingredients }),
    ...(input.instructions !== undefined && { instructions: input.instructions }),
    ...(input.category !== undefined && { category: input.category }),
    ...(input.prepTime !== undefined && { prepTime: Number(input.prepTime) }),
    ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
  };

  const res: any = await client.graphql({
    query: `mutation UpdateRecipe($input: UpdateRecipeInput!) { updateRecipe(input: $input) { ${RECIPE_FIELDS} } }`,
    variables: { input: sanitizedInput },
    authMode: 'userPool',
  });
  return res.data.updateRecipe;
}

export async function deleteRecipe(id: string): Promise<void> {
  await client.graphql({
    query: `mutation DeleteRecipe($id: ID!) { deleteRecipe(id: $id) { id } }`,
    variables: { id },
    authMode: 'userPool',
  });
}

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
  return (await body.json()) as unknown as Stats;
}