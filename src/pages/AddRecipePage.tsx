import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createRecipe, getRecipe, updateRecipe, uploadRecipeImage } from '../api';
import { useAuth } from '../auth';
import type { Recipe } from '../types';

export default function AddRecipePage() {
  const { id } = useParams();
  const recipeId = id || null;
  const isEdit = recipeId !== null;
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [ingredients, setIngredients] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingRecipe, setLoadingRecipe] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !recipeId) return;
    let cancelled = false;
    getRecipe(recipeId)
      .then((recipe: Recipe) => {
        if (cancelled) return;
        if (!recipe) {
          setError('Recipe not found');
          setLoadingRecipe(false);
          return;
        }
        setTitle(recipe.title);
        setDescription(recipe.description || '');
        setIngredients(recipe.ingredients?.join('\n') || '');
        setInstructions(recipe.instructions || '');
        setCategory(recipe.category || '');
        setPrepTime(recipe.prepTime?.toString() || '');
        setCurrentImage(recipe.imageUrl || null);
        setLoadingRecipe(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load recipe');
        setLoadingRecipe(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isEdit, recipeId]);

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImage(file);
    setRemoveImage(false);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  function clearImage() {
    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (image) {
      setImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (currentImage) setRemoveImage(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Upload image to S3 if a new file is selected
      let imageUrl: string | null | undefined = currentImage && !removeImage ? currentImage : null;
      if (image) {
        imageUrl = await uploadRecipeImage(image);
      }
      // If removeImage is true and no new image, explicitly set to null to remove it
      if (removeImage && !image) {
        imageUrl = null;
      }

      const ingredientsArray = ingredients.split('\n').filter((i) => i.trim());

      const recipeInput = {
        title,
        description,
        ingredients: ingredientsArray,
        instructions,
        category,
        prepTime: prepTime ? parseInt(prepTime, 10) : undefined,
        imageUrl: imageUrl === undefined ? undefined : imageUrl,
        authorId: user?.id || '',
        authorName: user?.name || '',
      };

      if (isEdit && recipeId) {
        const updateInput = {
          id: recipeId,
          ...recipeInput,
        };
        await updateRecipe(updateInput);
        navigate(`/recipes/${recipeId}`);
      } else {
        await createRecipe(recipeInput);
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save recipe');
      setLoading(false);
    }
  }

  if (loadingRecipe) {
    return (
      <main className="page form-page">
        <p className="muted">Loading…</p>
      </main>
    );
  }

  const displayImage = preview ?? (currentImage && !removeImage ? currentImage : null);

  return (
    <main className="page form-page">
      <h1 style={{ fontSize: '2rem', color: 'var(--primary)', fontFamily: 'Georgia, serif' }}>
        {isEdit ? '✏️ Edit recipe' : '🍳 Add new recipe'}
      </h1>
      {error && <p className="error">{error}</p>}
      <form className="recipe-form" onSubmit={onSubmit}>
        <label>
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="e.g., Classic Margherita Pizza"
          />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Brief description of the recipe"
          />
        </label>
        <label>
          Ingredients
          <textarea
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            required
            rows={4}
            placeholder={'One ingredient per line, e.g.\nFlour\nEggs\nMilk'}
          />
        </label>
        <label>
          Instructions
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            required
            rows={7}
            placeholder={'One step per line, e.g.\nPreheat the oven\nMix the batter'}
          />
        </label>
        <label>
          Category
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g., Dinner, Dessert"
          />
        </label>
        <label>
          Prep Time (minutes)
          <input
            type="number"
            value={prepTime}
            onChange={(e) => setPrepTime(e.target.value)}
            placeholder="e.g., 30"
          />
        </label>
        <div className="image-picker">
          <span className="image-picker-label">📷 Photo (optional)</span>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} hidden />
          {displayImage ? (
            <div className="image-preview">
              <img src={displayImage} alt="Preview" />
              <div className="image-preview-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change image
                </button>
                <button type="button" className="secondary" onClick={clearImage}>
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="secondary add-image-button"
              onClick={() => fileInputRef.current?.click()}
            >
              ＋ Add image
            </button>
          )}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? '💾 Save changes' : '🍳 Save recipe'}
        </button>
      </form>
    </main>
  );
}
