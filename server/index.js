import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createSchema, createYoga } from 'graphql-yoga';
import db from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'recipeshare-dev-secret';

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// ---------- helpers ----------

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

function getUserFromToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(payload.id) || null;
  } catch {
    return null;
  }
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const user = token ? getUserFromToken(token) : null;
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  next();
}

function canModifyRecipe(user, recipe) {
  return user.role === 'admin' || recipe.owner_id === user.id;
}

function removeUploadedFile(filename) {
  if (!filename) return;
  const value = String(filename);
  if (/^https?:\/\//.test(value)) return;
  const file = path.join(uploadsDir, path.basename(value));
  fs.rm(file, { force: true }, () => {});
}

function normalizeImageForDb(image) {
  if (!image) return null;
  const value = String(image).trim();
  if (!value) return null;
  if (value.startsWith('/uploads/')) return path.basename(value);
  return value;
}

function rowToRecipe(row) {
  if (!row) return null;
  const image = row.image ? String(row.image) : null;
  const publicImage = image
    ? image.startsWith('/uploads/') || /^https?:\/\//.test(image)
      ? image
      : `/uploads/${image}`
    : null;
  return {
    ...row,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email ?? null,
    image: publicImage,
    createdAt: row.created_at,
  };
}

const recipeSelect = `
  SELECT r.*, u.email AS owner_email
  FROM recipes r
  JOIN users u ON u.id = r.owner_id
`;

// ---------- seed ----------

function seed() {
  const adminHash = bcrypt.hashSync('admin123', 10);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@recipeshare.com');
  let adminId;
  if (existing) {
    adminId = existing.id;
    db.prepare("UPDATE users SET password_hash = ?, role = 'admin' WHERE id = ?").run(
      adminHash,
      adminId,
    );
  } else {
    adminId = db
      .prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')")
      .run('admin@recipeshare.com', adminHash).lastInsertRowid;
  }

  const count = db.prepare('SELECT COUNT(*) AS c FROM recipes').get().c;
  if (count === 0) {
    const insert = db.prepare(
      'INSERT INTO recipes (title, ingredients, steps, owner_id) VALUES (?, ?, ?, ?)',
    );
    insert.run(
      'Classic Margherita Pizza',
      'Pizza dough, tomato sauce, fresh mozzarella, basil leaves, olive oil, salt',
      '1. Preheat oven to 250°C.\n2. Stretch the dough into a round base.\n3. Spread tomato sauce and add mozzarella.\n4. Bake for 10-12 minutes until golden.\n5. Top with fresh basil and drizzle olive oil.',
      adminId,
    );
    insert.run(
      'Fluffy Pancakes',
      '200g flour, 2 eggs, 300ml milk, 1 tbsp sugar, 1 tsp baking powder, butter',
      '1. Whisk flour, sugar and baking powder together.\n2. Beat in eggs and milk until smooth.\n3. Rest the batter for 10 minutes.\n4. Cook ladles of batter in a buttered pan, 2 minutes per side.\n5. Serve warm with syrup.',
      adminId,
    );
    insert.run(
      'Chicken Caesar Salad',
      'Romaine lettuce, grilled chicken breast, Caesar dressing, croutons, parmesan',
      '1. Grill chicken until cooked through and slice.\n2. Chop romaine lettuce.\n3. Toss with dressing and croutons.\n4. Top with chicken slices and shaved parmesan.',
      adminId,
    );
  }
}
seed();

// ---------- REST auth ----------

app.post('/api/auth/signup', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (String(password).length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = bcrypt.hashSync(String(password), 10);
  const id = db
    .prepare("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'user')")
    .run(email, hash).lastInsertRowid;
  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(id);
  res.status(201).json({ token: signToken(user), user });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const safe = { id: user.id, email: user.email, role: user.role, created_at: user.created_at };
  res.json({ token: signToken(user), user: safe });
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

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

app.post('/api/recipes', authRequired, upload.single('image'), (req, res) => {
  const { title, ingredients, steps } = req.body || {};
  if (!title || !ingredients || !steps) {
    return res.status(400).json({ error: 'Title, ingredients and steps are required' });
  }
  const image = req.file ? req.file.filename : null;
  const id = db
    .prepare(
      'INSERT INTO recipes (title, ingredients, steps, image, owner_id) VALUES (?, ?, ?, ?, ?)',
    )
    .run(title, ingredients, steps, image, req.user.id).lastInsertRowid;
  const recipe = db.prepare(`${recipeSelect} WHERE r.id = ?`).get(id);
  res.status(201).json(rowToRecipe(recipe));
});

const updateRecipeHandler = (req, res) => {
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  if (!canModifyRecipe(req.user, recipe)) {
    return res.status(403).json({ error: 'You can only update your own recipes' });
  }

  const { title, ingredients, steps, removeImage } = req.body || {};
  const nextTitle = title === undefined ? recipe.title : String(title).trim();
  const nextIngredients =
    ingredients === undefined ? recipe.ingredients : String(ingredients).trim();
  const nextSteps = steps === undefined ? recipe.steps : String(steps).trim();
  if (!nextTitle || !nextIngredients || !nextSteps) {
    return res.status(400).json({ error: 'Title, ingredients and steps cannot be empty' });
  }

  let image = recipe.image;
  let oldImage = null;
  if (req.file) {
    oldImage = recipe.image;
    image = req.file.filename;
  } else if (removeImage === 'true' || removeImage === true) {
    oldImage = recipe.image;
    image = null;
  }

  db.prepare(
    'UPDATE recipes SET title = ?, ingredients = ?, steps = ?, image = ? WHERE id = ?',
  ).run(nextTitle, nextIngredients, nextSteps, image, recipe.id);
  if (oldImage && oldImage !== image) removeUploadedFile(oldImage);

  const updated = db.prepare(`${recipeSelect} WHERE r.id = ?`).get(recipe.id);
  res.json(rowToRecipe(updated));
};

app.put('/api/recipes/:id', authRequired, upload.single('image'), updateRecipeHandler);
app.patch('/api/recipes/:id', authRequired, upload.single('image'), updateRecipeHandler);

app.delete('/api/recipes/:id', authRequired, (req, res) => {
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  if (!canModifyRecipe(req.user, recipe)) {
    return res.status(403).json({ error: 'You can only delete your own recipes' });
  }
  db.prepare('DELETE FROM recipes WHERE id = ?').run(recipe.id);
  removeUploadedFile(recipe.image);
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
      ownerId: Int!
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
            'INSERT INTO recipes (title, ingredients, steps, image, owner_id) VALUES (?, ?, ?, ?, ?)',
          )
          .run(
            args.title,
            args.ingredients,
            args.steps,
            normalizeImageForDb(args.image),
            user.id,
          ).lastInsertRowid;
        return rowToRecipe(db.prepare(`${recipeSelect} WHERE r.id = ?`).get(id));
      },
      updateRecipe: (_root, args, context) => {
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
        if (oldImage && oldImage !== image) removeUploadedFile(oldImage);
        return rowToRecipe(db.prepare(`${recipeSelect} WHERE r.id = ?`).get(recipe.id));
      },
      deleteRecipe: (_root, args, context) => {
        const user = context.user;
        if (!user) throw new Error('Authentication required');
        const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(args.id);
        if (!recipe) throw new Error('Recipe not found');
        if (!canModifyRecipe(user, recipe)) {
          throw new Error('You can only delete your own recipes');
        }
        db.prepare('DELETE FROM recipes WHERE id = ?').run(recipe.id);
        removeUploadedFile(recipe.image);
        return true;
      },
    },
  },
});

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/graphql',
  context: ({ request }) => {
    const header = request.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    return { user: token ? getUserFromToken(token) : null };
  },
});

app.use('/graphql', yoga);

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Bad request' });
});

app.listen(PORT, () => {
  console.log(`RecipeShare API running on http://localhost:${PORT}`);
});
