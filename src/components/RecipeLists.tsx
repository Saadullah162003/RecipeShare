interface RecipeListsProps {
  ingredients: string;
  steps: string;
}

function toLines(text: string, stripPattern: RegExp, splitCommas: boolean): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((l) => (splitCommas ? l.split(',') : [l]))
    .map((l) => l.trim().replace(stripPattern, '').trim())
    .filter(Boolean);
}

export default function RecipeLists({ ingredients, steps }: RecipeListsProps) {
  const ingredientItems = toLines(ingredients, /^[-•*]\s*/, true);
  const stepItems = toLines(steps, /^\d+[.)]\s*/, false);

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
