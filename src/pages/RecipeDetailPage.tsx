import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deleteRecipe, listRecipes } from '../api';
import { useAuth } from '../auth';
import RecipeLists from '../components/RecipeLists';
import type { Recipe } from '../types';

export default function RecipeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await listRecipes();
      setRecipe(all.find((r) => String(r.id) === id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipe');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete() {
    if (!recipe || !window.confirm('Delete this recipe?')) return;
    try {
      await deleteRecipe(recipe.id);
      window.location.href = '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  if (error)
    return (
      <main className="page">
        <p className="error">{error}</p>
      </main>
    );
  if (!recipe)
    return (
      <main className="page">
        <p className="muted">Loading…</p>
      </main>
    );

  const canDelete = user && (user.role === 'admin' || recipe.ownerId === user.id);

  return (
    <main className="page detail-page">
      {recipe.image ? (
        <img className="detail-image" src={recipe.image} alt={recipe.title} />
      ) : (
        <div className="detail-image placeholder-large">🍽️</div>
      )}
      <h1 style={{ fontSize: '2.2rem', color: 'var(--primary)', fontFamily: 'Georgia, serif' }}>
        {recipe.title}
      </h1>
      <p className="muted" style={{ fontSize: '0.95rem', marginBottom: '1.25rem' }}>
        by <strong>{recipe.ownerEmail}</strong> · {new Date(recipe.createdAt).toLocaleDateString()}
      </p>
      {canDelete && (
        <div className="detail-actions">
          <Link className="link-button" to={`/recipes/${recipe.id}/edit`}>
            ✏️ Edit recipe
          </Link>
          <button className="danger" onClick={onDelete}>
            🗑️ Delete recipe
          </button>
        </div>
      )}
      <RecipeLists ingredients={recipe.ingredients} steps={recipe.steps} />
      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/">← Back to gallery</Link>
      </p>
    </main>
  );
}
