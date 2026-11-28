interface RecipeListsProps {
  ingredients: string;
  steps: string;
}

export default function RecipeLists({ ingredients, steps }: RecipeListsProps) {
  // Split by newlines only, don't try to strip formatting
  const ingredientItems = ingredients
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  const stepItems = steps
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return (
    <>
      <section>
        <h2>🥘 Ingredients</h2>
        <ul className="ingredient-list">
          {ingredientItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2>👨‍🍳 Instructions</h2>
        <ol className="step-list">
          {stepItems.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      </section>
    </>
  );
}
