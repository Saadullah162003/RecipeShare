import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,


  AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  S3Client,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { createSchema, createYoga } from 'graphql-yoga';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'recipeshare-dev-secret';

// Cognito Configuration
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.COGNITO_REGION || 'us-east-1',
});
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID;
const CLIENT_SECRET = process.env.COGNITO_CLIENT_SECRET;

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.S3_REGION || 'ap-southeast-2',
});
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

const app = express();
app.use(cors());
app.use(express.json());

// ---------- helpers ----------

function signToken(user) {
  return jwt.sign({ sub: user.cognito_sub, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

async function _getUserFromCognitoToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT cognito_sub, email, role FROM users WHERE cognito_sub = ?').get(payload.sub);
    return user || null;
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT cognito_sub, email, role FROM users WHERE cognito_sub = ?').get(payload.sub);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Authentication required' });
  }
}

function canModifyRecipe(user, recipe) {
  return user.role === 'admin' || recipe.owner_sub === user.cognito_sub;
}

async function removeUploadedFile(imageUrl) {
  if (!imageUrl) return;
  const value = String(imageUrl);
  if (!/^https?:\/\//.test(value)) return;
  
  try {
    // Extract key from S3 URL
    const url = new URL(value);
    const key = url.pathname.substring(1); // Remove leading slash
    
    const deleteCommand = new DeleteObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(deleteCommand);
  } catch (error) {
    console.error('Failed to delete image from S3:', error);
  }
}

function normalizeImageForDb(image) {
  if (!image) return null;
  const value = String(image).trim();
  if (!value) return null;
  // Already an S3 URL or external URL, return as-is
  if (/^https?:\/\//.test(value)) return value;
  return value;
}

function rowToRecipe(row) {
  if (!row) return null;
  const image = row.image ? String(row.image) : null;
  // Image is now stored as full S3 URL in the database
  return {
    ...row,
    ownerSub: row.owner_sub,
    ownerEmail: row.owner_email ?? null,
    image: image,
    createdAt: row.created_at,
  };
}

const recipeSelect = `
  SELECT r.*, u.email AS owner_email
  FROM recipes r
  JOIN users u ON u.cognito_sub = r.owner_sub
`;

// ---------- seed ----------

function seed() {
  // Note: With Cognito, users are managed in AWS Cognito, not in the local database
  // The admin user should be created in Cognito and added to the Admins group
  // For now, we'll seed recipes without an owner until a user signs up
  
  const count = db.prepare('SELECT COUNT(*) AS c FROM recipes').get().c;
  if (count === 0) {
    // Create a placeholder admin user in DB for seed data
    // This will be replaced when the actual admin signs in via Cognito
    const adminSub = 'admin-placeholder';
    const existing = db.prepare('SELECT cognito_sub FROM users WHERE cognito_sub = ?').get(adminSub);
    if (!existing) {
      db.prepare("INSERT INTO users (cognito_sub, email, role) VALUES (?, ?, 'admin')")
        .run(adminSub, 'admin@recipeshare.com');
    }

    const insert = db.prepare(
      'INSERT INTO recipes (title, ingredients, steps, owner_sub) VALUES (?, ?, ?, ?)',
    );
    insert.run(
      'Classic Margherita Pizza',
      'Pizza dough, tomato sauce, fresh mozzarella, basil leaves, olive oil, salt',
      '1. Preheat oven to 250°C.\n2. Stretch the dough into a round base.\n3. Spread tomato sauce and add mozzarella.\n4. Bake for 10-12 minutes until golden.\n5. Top with fresh basil and drizzle olive oil.',
      adminSub,
    );
    insert.run(
      'Fluffy Pancakes',
      '200g flour, 2 eggs, 300ml milk, 1 tbsp sugar, 1 tsp baking powder, butter',
      '1. Whisk flour, sugar and baking powder together.\n2. Beat in eggs and milk until smooth.\n3. Rest the batter for 10 minutes.\n4. Cook ladles of batter in a buttered pan, 2 minutes per side.\n5. Serve warm with syrup.',
      adminSub,
    );
    insert.run(
      'Chicken Caesar Salad',
      'Romaine lettuce, grilled chicken breast, Caesar dressing, croutons, parmesan',
      '1. Grill chicken until cooked through and slice.\n2. Chop romaine lettuce.\n3. Toss with dressing and croutons.\n4. Top with chicken slices and shaved parmesan.',
      adminSub,
    );
  }
}
seed();

// ---------- REST auth ----------

// Exchange Cognito tokens for app token
app.post('/api/auth/exchange', async (req, res) => {
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Authorization code required' });

  try {
    // Exchange the authorization code for tokens with Cognito
    // This is a simplified version - in production, you'd use the full OAuth2 flow
    const tokenResponse = await fetch(
      `https://${process.env.COGNITO_DOMAIN}.auth.${process.env.COGNITO_REGION}.amazoncognito.com/oauth2/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: process.env.COGNITO_REDIRECT_URI,
        }),
      },
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return res.status(400).json({ error: 'Failed to exchange token' });
    }

    const tokens = await tokenResponse.json();
    
    // Decode the ID token to get user info
    const idTokenPayload = jwt.decode(tokens.id_token);
    const cognitoSub = idTokenPayload.sub;
    const email = idTokenPayload.email;

    // Get user's groups from Cognito
    const groupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: cognitoSub,
    });
    const groupsResponse = await cognitoClient.send(groupsCommand);
    const groupNames = groupsResponse.Groups?.map(g => g.GroupName) || [];
    const role = groupNames.includes('Admins') ? 'admin' : 'user';

    // Sync user to local database
    const existing = db.prepare('SELECT cognito_sub, email, role FROM users WHERE cognito_sub = ?').get(cognitoSub);
    let user;
    if (existing) {
      // Update role if changed
      if (existing.role !== role) {
        db.prepare('UPDATE users SET role = ? WHERE cognito_sub = ?').run(role, cognitoSub);
      }
      user = { cognito_sub: cognitoSub, email, role };
    } else {
      // Create new user
      db.prepare('INSERT INTO users (cognito_sub, email, role) VALUES (?, ?, ?)')
        .run(cognitoSub, email, role);
      user = { cognito_sub: cognitoSub, email, role };
    }

    // Issue app token
    const appToken = signToken(user);
    res.json({ token: appToken, user });
  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Email/password signup (for users who prefer not to use Google OAuth)
app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const signUpCommand = new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
      ],
    });
    await cognitoClient.send(signUpCommand);
    
    res.status(201).json({ 
      message: 'Signup successful. Please check your email for confirmation code.',
      requiresConfirmation: true 
    });
  } catch (error) {
    if (error.name === 'UsernameExistsException') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// Confirm signup
app.post('/api/auth/confirm', async (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: 'Email and confirmation code required' });

  try {
    const confirmCommand = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    });
    await cognitoClient.send(confirmCommand);
    
    res.json({ message: 'Account confirmed successfully' });
  } catch (error) {
    console.error('Confirm error:', error);
    res.status(400).json({ error: 'Invalid confirmation code' });
  }
});

// Email/password login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const authCommand = new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });
    const authResponse = await cognitoClient.send(authCommand);
    
    if (authResponse.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      return res.status(400).json({ 
        error: 'Password change required',
        challenge: 'NEW_PASSWORD_REQUIRED',
        session: authResponse.Session,
      });
    }

    const idTokenPayload = jwt.decode(authResponse.AuthenticationResult.IdToken);
    const cognitoSub = idTokenPayload.sub;
    const userEmail = idTokenPayload.email;

    // Get user's groups from Cognito
    const groupsCommand = new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: cognitoSub,
    });
    const groupsResponse = await cognitoClient.send(groupsCommand);
    const groupNames = groupsResponse.Groups?.map(g => g.GroupName) || [];
    const role = groupNames.includes('Admins') ? 'admin' : 'user';

    // Sync user to local database
    const existing = db.prepare('SELECT cognito_sub, email, role FROM users WHERE cognito_sub = ?').get(cognitoSub);
    let user;
    if (existing) {
      if (existing.role !== role) {
        db.prepare('UPDATE users SET role = ? WHERE cognito_sub = ?').run(role, cognitoSub);
      }
      user = { cognito_sub: cognitoSub, email: userEmail, role };
    } else {
      db.prepare('INSERT INTO users (cognito_sub, email, role) VALUES (?, ?, ?)')
        .run(cognitoSub, userEmail, role);
      user = { cognito_sub: cognitoSub, email: userEmail, role };
    }

    const appToken = signToken(user);
    res.json({ token: appToken, user });
  } catch (error) {
    if (error.name === 'NotAuthorizedException' || error.name === 'UserNotFoundException') {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    if (error.name === 'UserNotConfirmedException') {
      return res.status(403).json({ error: 'Please confirm your account first' });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

// ---------- REST recipes / stats ----------

app.get('/api/stats', authRequired, (req, res) => {
  const recipeCount = db.prepare('SELECT COUNT(*) AS c FROM recipes').get().c;
  const latest = db
    .prepare('SELECT title FROM recipes ORDER BY created_at DESC, id DESC LIMIT 1')
    .get();
  res.json({ recipeCount, latestRecipeTitle: latest ? latest.title : null });
});

app.post('/api/recipes', authRequired, async (req, res) => {
  const { title, ingredients, steps, image } = req.body || {};
  if (!title || !ingredients || !steps) {
    return res.status(400).json({ error: 'Title, ingredients and steps are required' });
  }
  // Image is now expected to be an S3 URL from the frontend
  const id = db
    .prepare(
      'INSERT INTO recipes (title, ingredients, steps, image, owner_sub) VALUES (?, ?, ?, ?, ?)',
    )
    .run(title, ingredients, steps, image || null, req.user.cognito_sub).lastInsertRowid;
  const recipe = db.prepare(`${recipeSelect} WHERE r.id = ?`).get(id);
  res.status(201).json(rowToRecipe(recipe));
});

const updateRecipeHandler = async (req, res) => {
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  if (!canModifyRecipe(req.user, recipe)) {
    return res.status(403).json({ error: 'You can only update your own recipes' });
  }

  const { title, ingredients, steps, image, removeImage } = req.body || {};
  const nextTitle = title === undefined ? recipe.title : String(title).trim();
  const nextIngredients =
    ingredients === undefined ? recipe.ingredients : String(ingredients).trim();
  const nextSteps = steps === undefined ? recipe.steps : String(steps).trim();
  if (!nextTitle || !nextIngredients || !nextSteps) {
    return res.status(400).json({ error: 'Title, ingredients and steps cannot be empty' });
  }

  let finalImage = recipe.image;
  let oldImage = null;
  
  if (image !== undefined) {
    oldImage = recipe.image;
    finalImage = image;
  } else if (removeImage === 'true' || removeImage === true) {
    oldImage = recipe.image;
    finalImage = null;
  }

  db.prepare(
    'UPDATE recipes SET title = ?, ingredients = ?, steps = ?, image = ? WHERE id = ?',
  ).run(nextTitle, nextIngredients, nextSteps, finalImage, recipe.id);
  
  if (oldImage && oldImage !== finalImage) {
    await removeUploadedFile(oldImage);
  }

  const updated = db.prepare(`${recipeSelect} WHERE r.id = ?`).get(recipe.id);
  res.json(rowToRecipe(updated));
};

app.put('/api/recipes/:id', authRequired, updateRecipeHandler);
app.patch('/api/recipes/:id', authRequired, updateRecipeHandler);

app.delete('/api/recipes/:id', authRequired, async (req, res) => {
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  if (!canModifyRecipe(req.user, recipe)) {
    return res.status(403).json({ error: 'You can only delete your own recipes' });
  }
  db.prepare('DELETE FROM recipes WHERE id = ?').run(recipe.id);
  await removeUploadedFile(recipe.image);
  res.json({ success: true });
});

// ---------- GraphQL ----------

const schema = createSchema({
  typeDefs: /* GraphQL */ `
    type Recipe {
      id: Int!
      title: String!
      ingredients: String!
      steps: String!
      image: String
      ownerSub: String!
      ownerEmail: String
      createdAt: String!
    }

    type Query {
      listRecipes: [Recipe!]!
    }

    type Mutation {
      createRecipe(title: String!, ingredients: String!, steps: String!, image: String): Recipe!
      updateRecipe(
        id: Int!
        title: String
        ingredients: String
        steps: String
        image: String
        removeImage: Boolean
      ): Recipe!
      deleteRecipe(id: Int!): Boolean!
    }
  `,
  resolvers: {
    Query: {
      listRecipes: (_root, _args, context) => {
        if (!context.user) throw new Error('Authentication required');
        const rows = db.prepare(`${recipeSelect} ORDER BY r.created_at DESC, r.id DESC`).all();
        return rows.map(rowToRecipe);
      },
    },
    Mutation: {
      createRecipe: (_root, args, context) => {
        const user = context.user;
        if (!user) throw new Error('Authentication required');
        const id = db
          .prepare(
            'INSERT INTO recipes (title, ingredients, steps, image, owner_sub) VALUES (?, ?, ?, ?, ?)',
          )
          .run(
            args.title,
            args.ingredients,
            args.steps,
            normalizeImageForDb(args.image),
            user.cognito_sub,
          ).lastInsertRowid;
        return rowToRecipe(db.prepare(`${recipeSelect} WHERE r.id = ?`).get(id));
      },
      updateRecipe: async (_root, args, context) => {
        const user = context.user;
        if (!user) throw new Error('Authentication required');
        const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(args.id);
        if (!recipe) throw new Error('Recipe not found');
        if (!canModifyRecipe(user, recipe)) {
          throw new Error('You can only update your own recipes');
        }

        const title = args.title === undefined ? recipe.title : String(args.title).trim();
        const ingredients =
          args.ingredients === undefined ? recipe.ingredients : String(args.ingredients).trim();
        const steps = args.steps === undefined ? recipe.steps : String(args.steps).trim();
        if (!title || !ingredients || !steps) {
          throw new Error('Title, ingredients and steps cannot be empty');
        }

        const oldImage = recipe.image;
        let image = recipe.image;
        if (args.removeImage === true) image = null;
        else if (args.image !== undefined) image = normalizeImageForDb(args.image);

        db.prepare(
          'UPDATE recipes SET title = ?, ingredients = ?, steps = ?, image = ? WHERE id = ?',
        ).run(title, ingredients, steps, image, recipe.id);
        if (oldImage && oldImage !== image) await removeUploadedFile(oldImage);
        return rowToRecipe(db.prepare(`${recipeSelect} WHERE r.id = ?`).get(recipe.id));
      },
      deleteRecipe: async (_root, args, context) => {
        const user = context.user;
        if (!user) throw new Error('Authentication required');
        const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(args.id);
        if (!recipe) throw new Error('Recipe not found');
        if (!canModifyRecipe(user, recipe)) {
          throw new Error('You can only delete your own recipes');
        }
        db.prepare('DELETE FROM recipes WHERE id = ?').run(recipe.id);
        await removeUploadedFile(recipe.image);
        return true;
      },
    },
  },
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  context: async ({ request }) => {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return { user: null };
    
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = db.prepare('SELECT cognito_sub, email, role FROM users WHERE cognito_sub = ?').get(payload.sub);
      return { user: user || null };
    } catch {
      return { user: null };
    }
  },
});

app.use('/graphql', yoga);

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Bad request' });
});

app.listen(PORT, () => {
  console.log(`RecipeShare API running on http://localhost:${PORT}`);
});
