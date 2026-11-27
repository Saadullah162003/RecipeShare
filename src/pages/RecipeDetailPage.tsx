import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { deleteRecipe, getRecipe } from '../api';
import { useAuth } from '../auth';
import RecipeLists from '../components/RecipeLists';
import type { Recipe } from '../types';

export default function RecipeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await getRecipe(id);
      setRecipe(r);
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

  const canDelete = user && (user.isAdmin || recipe.authorId === user.id);

  return (
    <main className="page detail-page">
      {recipe.imageUrl ? (
        <img className="detail-image" src={recipe.imageUrl} alt={recipe.title} />
      ) : (
        <div className="detail-image placeholder-large">🍽️</div>
      )}
      <h1 style={{ fontSize: '2.2rem', color: 'var(--primary)', fontFamily: 'Georgia, serif' }}>
        {recipe.title}
      </h1>
      <p className="muted" style={{ fontSize: '0.95rem', marginBottom: '1.25rem' }}>
        by <strong>{recipe.authorName}</strong> · {new Date(recipe.createdAt).toLocaleDateString()}
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
      <RecipeLists ingredients={recipe.ingredients?.join('\n') || ''} steps={recipe.instructions || ''} />
      <p style={{ marginTop: '1.5rem' }}>
        <Link to="/">← Back to gallery</Link>
      </p>
    </main>
  );
}
