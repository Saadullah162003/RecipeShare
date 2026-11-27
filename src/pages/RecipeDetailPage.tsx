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
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        {recipe.category && (
          <span style={{ 
            background: 'var(--primary)', 
            color: 'white', 
            padding: '0.25rem 0.75rem', 
            borderRadius: '1rem', 
            fontSize: '0.875rem' 
          }}>
            {recipe.category}
          </span>
        )}
        {recipe.prepTime && (
          <span className="muted" style={{ fontSize: '0.95rem' }}>
            ⏱️ {recipe.prepTime} min prep time
          </span>
        )}
        <span className="muted" style={{ fontSize: '0.95rem' }}>
          by <strong>{recipe.authorName}</strong> · {new Date(recipe.createdAt).toLocaleDateString()}
        </span>
      </div>
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
