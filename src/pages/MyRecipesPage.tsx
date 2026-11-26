import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteRecipe, listRecipes } from '../api';
import { useAuth } from '../auth';
import type { Recipe } from '../types';

export default function MyRecipesPage() {
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const all = await listRecipes();
      setRecipes(all.filter((r) => r.ownerId === user?.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDelete(id: number) {
    if (!window.confirm('Delete this recipe?')) return;
    try {
      await deleteRecipe(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <h1>👨‍🍳 My recipes</h1>
      </div>
      {error && <p className="error">{error}</p>}
      {recipes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-light)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🍳</div>
          <p style={{ fontSize: '1.1rem', fontStyle: 'italic' }}>
            You haven&apos;t added any recipes yet. <Link to="/add">Add one</Link>.
          </p>
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((r) => (
            <div className="recipe-card" key={r.id}>
              <Link to={`/recipes/${r.id}`}>
                {r.image ? (
                  <img src={r.image} alt={r.title} loading="lazy" />
                ) : (
                  <div className="recipe-placeholder">🍽️</div>
                )}
                <h3>{r.title}</h3>
              </Link>
              <div className="card-actions">
                <Link className="link-button" to={`/recipes/${r.id}/edit`}>
                  Edit
                </Link>
                <button className="danger small-button" onClick={() => onDelete(r.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
