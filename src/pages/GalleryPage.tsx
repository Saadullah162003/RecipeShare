import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteRecipe, fetchStats, fetchRecipes } from '../api';
import { useAuth } from '../auth';
import type { Recipe, Stats } from '../types';

export default function GalleryPage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([fetchRecipes(), fetchStats()]);
      setRecipes(r);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(id: string) {
    if (!window.confirm('Delete this recipe?')) return;
    try {
      await deleteRecipe(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function canDelete(r: Recipe) {
    return !!user && (user.isAdmin || r.authorId === user.id);
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>🍽️ Recipe Gallery</h1>
        {stats && (
          <p className="muted small">
            {stats.totalRecipes} recipe{stats.totalRecipes === 1 ? '' : 's'}
          </p>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      {recipes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🍳</div>
          <p style={{ fontSize: '1.1rem', fontStyle: 'italic' }}>
            No recipes yet. Be the first to add one!
          </p>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((r) => (
            <div className="recipe-card" key={r.id}>
              <Link to={`/recipes/${r.id}`}>
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt={r.title} loading="lazy" />
                ) : (
                  <div className="recipe-placeholder">🍽️</div>
                )}
                <h3>{r.title}</h3>
              </Link>
              <p className="muted small">by {r.authorName}</p>
              {canDelete(r) && (
                <div className="card-actions">
                  <Link className="link-button" to={`/recipes/${r.id}/edit`}>
                    Edit
                  </Link>
                  <button className="danger small-button" onClick={() => onDelete(r.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
