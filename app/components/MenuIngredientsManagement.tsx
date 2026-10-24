"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MenuRow = { id: string; name: string; category_id: string | null; is_available: boolean };
type CategoryRow = { id: string; name: string };
type InventoryRow = { inventory_id: number; ingredient_name: string; unit: string; quantity: number; reorder_level: number; status: "available" | "unavailable" | "low_stock" };
type RecipeRow = { id: string; menu_item_id: string; inventory_id: number; menu_name: string; ingredient_name: string; unit: string; quantity_required: number };

const nfmt = (value: number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 });

export default function MenuIngredientsManagement({ canManage }: { canManage: boolean }) {
  const [menu, setMenu] = useState<MenuRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selected, setSelected] = useState<MenuRow | null>(null);
  const [editing, setEditing] = useState<RecipeRow | null>(null);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [menuResult, categoryResult, inventoryResult, recipeResult] = await Promise.all([
      supabase.from("menu_items").select("id, name, category_id, is_available").order("name"),
      supabase.from("categories").select("id, name").order("sort_order"),
      supabase.from("inventory").select("inventory_id, ingredient_name, unit, quantity, reorder_level, status").order("ingredient_name"),
      supabase.from("menu_ingredients").select("id, menu_item_id, inventory_id, menu_name, ingredient_name, unit, quantity_required"),
    ]);
    const firstError = menuResult.error || categoryResult.error || inventoryResult.error || recipeResult.error;
    if (firstError) setError(firstError.message);
    else {
      setError("");
      setMenu((menuResult.data ?? []) as MenuRow[]);
      setCategories((categoryResult.data ?? []) as CategoryRow[]);
      setInventory((inventoryResult.data ?? []) as InventoryRow[]);
      setRecipes((recipeResult.data ?? []) as RecipeRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("menu-ingredients-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_ingredients" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const categoryName = useCallback((id: string | null) => categories.find((category) => category.id === id)?.name ?? "Uncategorized", [categories]);
  const visibleMenu = useMemo(() => {
    const query = search.trim().toLowerCase();
    return menu.filter((item) => {
      const matchesMenuName = item.name.toLowerCase().includes(query);
      const matchesIngredient = recipes.some((recipe) =>
        recipe.menu_item_id === item.id && recipe.ingredient_name.toLowerCase().includes(query)
      );
      return (matchesMenuName || matchesIngredient) &&
        (categoryFilter === "all" || categoryName(item.category_id) === categoryFilter);
    });
  }, [menu, recipes, search, categoryFilter, categoryName]);
  const selectedRecipes = selected ? recipes.filter((recipe) => recipe.menu_item_id === selected.id) : [];
  const usedIngredients = selectedRecipes.map((recipe) => recipe.inventory_id);
  const availableIngredients = inventory.filter((item) => !usedIngredients.includes(item.inventory_id) || item.inventory_id === editing?.inventory_id);
  const inventoryById = new Map(inventory.map((item) => [item.inventory_id, item]));
  const recipeAvailable = Boolean(selected?.is_available && selectedRecipes.length > 0 && selectedRecipes.every((recipe) => {
    const ingredient = inventoryById.get(recipe.inventory_id);
    return ingredient && ingredient.status !== "unavailable" && Number(ingredient.quantity) >= Number(recipe.quantity_required);
  }));

  function startEdit(recipe: RecipeRow) {
    setEditing(recipe); setIngredientId(String(recipe.inventory_id)); setQuantity(String(recipe.quantity_required)); setError("");
  }

  async function saveRecipe() {
    if (!selected || !ingredientId || Number(quantity) <= 0) {
      setError("Choose an ingredient and enter a quantity greater than zero."); return;
    }
    setSaving(true); setError("");
    const result = editing
      ? await supabase.from("menu_ingredients").update({ inventory_id: Number(ingredientId), quantity_required: Number(quantity) }).eq("id", editing.id)
      : await supabase.from("menu_ingredients").insert({ menu_item_id: selected.id, inventory_id: Number(ingredientId), quantity_required: Number(quantity) });
    setSaving(false);
    if (result.error) { setError(result.error.message); return; }
    setEditing(null); setIngredientId(""); setQuantity(""); await load();
  }

  async function removeRecipe(recipe: RecipeRow) {
    const ingredient = inventoryById.get(recipe.inventory_id);
    if (!window.confirm(`Remove ${ingredient?.ingredient_name ?? "this ingredient"} from ${selected?.name ?? "the recipe"}?`)) return;
    const { error: deleteError } = await supabase.from("menu_ingredients").delete().eq("id", recipe.id);
    if (deleteError) setError(deleteError.message);
    else await load();
  }

  if (loading) return <div className="p-12 text-center text-sm text-[#8b7766]">Loading menu recipesÃ¢â‚¬Â¦</div>;

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a56831]">Recipes & usage</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#21140b]">Menu Ingredients</h1>
        <p className="mt-1 text-sm text-[#7d6b5c]">Set the ingredient quantities used for one menu item. Orders deduct these amounts from stock automatically.</p>
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-wrap gap-3 rounded-xl border border-[#eee5dc] bg-white p-4">
        <input aria-label="Search menu items or ingredients" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu items or ingredients..." className="w-full max-w-sm rounded-lg border border-[#e6d9cc] px-3 py-2 text-sm outline-none focus:border-[#9a6333]" />
        <select aria-label="Filter by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-[#e6d9cc] bg-white px-3 py-2 text-sm text-[#49382b]">
          <option value="all">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
        </select>
        <span className="self-center text-xs text-[#847365]">{visibleMenu.length} menu items</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleMenu.map((item) => {
          const linked = recipes.filter((recipe) => recipe.menu_item_id === item.id);
          const query = search.trim().toLowerCase();
          const matchingIngredients = query
            ? linked.filter((recipe) => recipe.ingredient_name.toLowerCase().includes(query))
            : [];
          const displayedRecipes = matchingIngredients.length > 0 ? matchingIngredients : linked.slice(0, 4);
          const missing = linked.length === 0;
          const blockedIngredient = linked.find((recipe) => {
            const ingredient = inventoryById.get(recipe.inventory_id);
            return !ingredient || ingredient.status === "unavailable" || Number(ingredient.quantity) < Number(recipe.quantity_required);
          });
          const recipeIsAvailable = item.is_available && !missing && !blockedIngredient;
          return <article key={item.id} className="flex flex-col rounded-xl border border-[#eee5dc] bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#a56831]">{categoryName(item.category_id)}</span>
                <h2 className="mt-1 truncate text-lg font-extrabold text-[#2b1a0e]">{item.name}</h2>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${recipeIsAvailable ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
                {recipeIsAvailable ? "Available" : missing ? "Recipe needed" : "Unavailable"}
              </span>
            </div>
            <p className="mt-2 text-xs text-[#847365]">{!item.is_available ? "Disabled in menu settings" : missing ? "No recipe configured" : blockedIngredient ? `${inventoryById.get(blockedIngredient.inventory_id)?.ingredient_name ?? "An ingredient"} is unavailable or has insufficient stock` : `${linked.length} ingredients | ready for ordering`}</p>
            <div className="mt-4 flex-1 space-y-2">
              {displayedRecipes.map((recipe) => {
                const ingredient = inventoryById.get(recipe.inventory_id);
                return <div key={recipe.id} className="flex justify-between gap-3 text-sm">
                  <span className="truncate text-[#5d4b3c]">{recipe.ingredient_name || ingredient?.ingredient_name || "Unknown ingredient"}</span>
                  <span className="shrink-0 font-bold text-[#2b1a0e]">{nfmt(recipe.quantity_required)} {recipe.unit || ingredient?.unit || ""}</span>
                </div>;
              })}
              {matchingIngredients.length === 0 && linked.length > 4 && <p className="text-xs text-[#8b7766]">+{linked.length - 4} more ingredients</p>}
              {missing && <p className="text-sm text-[#8b7766]">No recipe has been configured.</p>}
            </div>
            <button onClick={() => { setSelected(item); setEditing(null); setIngredientId(""); setQuantity(""); setError(""); }} className="mt-5 rounded-lg border border-[#d8c3ae] px-3 py-2 text-sm font-bold text-[#7c4a1e] hover:bg-[#faf5ef]">
              {canManage ? "Manage Recipe" : "View Ingredients"}
            </button>
          </article>;
        })}
        {visibleMenu.length === 0 && <p className="col-span-full rounded-xl border border-dashed border-[#d8c3ae] p-10 text-center text-sm text-[#8b7766]">No menu items or ingredients match your search.</p>}
      </div>

      {selected && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) { setSelected(null); setEditing(null); } }}>
        <section role="dialog" aria-modal="true" aria-labelledby="recipe-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 border-b border-[#eee5dc] px-6 py-5">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a56831]">{categoryName(selected.category_id)}</p><h2 id="recipe-title" className="mt-1 text-xl font-extrabold text-[#21140b]">{selected.name}</h2><p className="mt-1 text-sm text-[#7d6b5c]">Ingredient amounts required for one item</p><span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${recipeAvailable ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{recipeAvailable ? "Recipe available" : "Recipe unavailable"}</span></div>
            <button onClick={() => { setSelected(null); setEditing(null); }} aria-label="Close recipe" className="rounded-md px-2 py-1 text-xl text-[#7d6b5c] hover:bg-[#f5efe8]">&times;</button>
          </div>
          <div className="space-y-4 p-6">
            {selectedRecipes.length === 0 ? <p className="rounded-lg bg-[#faf7f3] p-4 text-sm text-[#7d6b5c]">No ingredients are linked to this menu item yet.</p> :
              <div className="overflow-x-auto rounded-lg border border-[#eee5dc]">
                <table className="w-full text-left text-sm"><thead className="bg-[#faf7f3] text-[11px] uppercase tracking-wide text-[#887869]"><tr><th className="px-4 py-3">Ingredient</th><th className="px-4 py-3">Per item</th><th className="px-4 py-3">Current stock</th><th className="px-4 py-3">Status</th>{canManage && <th className="px-4 py-3 text-right">Actions</th>}</tr></thead>
                  <tbody>{selectedRecipes.map((recipe) => {
                    const ingredient = inventoryById.get(recipe.inventory_id);
                    const low = ingredient && Number(ingredient.quantity) <= Number(ingredient.reorder_level);
                    const statusLabel = ingredient?.status === "unavailable" ? "Unavailable" : ingredient?.status === "low_stock" ? "Low stock" : ingredient ? "Available" : "Missing";
                    const statusClass = ingredient?.status === "unavailable" || !ingredient ? "bg-red-50 text-red-700" : ingredient.status === "low_stock" ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800";
                    return <tr key={recipe.id} className="border-t border-[#f1ebe5]"><td className="px-4 py-3 font-semibold text-[#2b1a0e]">{recipe.ingredient_name || ingredient?.ingredient_name || "Deleted ingredient"}</td><td className="px-4 py-3 font-bold">{nfmt(recipe.quantity_required)} {recipe.unit || ingredient?.unit}</td><td className="px-4 py-3"><span className={low ? "font-semibold text-amber-800" : "text-[#5d4b3c]"}>{ingredient ? `${nfmt(ingredient.quantity)} ${ingredient.unit}` : "Ã¢â‚¬â€"}{low ? " Ã‚Â· Low" : ""}</span></td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${statusClass}`}>{statusLabel}</span></td>{canManage && <td className="px-4 py-3"><div className="flex justify-end gap-2"><button onClick={() => startEdit(recipe)} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900">Edit</button><button onClick={() => void removeRecipe(recipe)} className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-800">Remove</button></div></td>}</tr>;
                  })}</tbody>
                </table>
              </div>}
            {canManage && <div className="rounded-xl border border-dashed border-[#d8c3ae] bg-[#fdfbf9] p-4">
              <h3 className="text-sm font-extrabold text-[#3b2a1d]">{editing ? "Edit recipe ingredient" : "Add recipe ingredient"}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
                <label className="block text-xs font-bold text-[#6f5d4e]">Ingredient
                  <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className="mt-1 w-full rounded-lg border border-[#e3d6ca] bg-white px-3 py-2.5 text-sm font-normal text-[#2b1a0e]">
                    <option value="">Select ingredient</option>{availableIngredients.map((ingredient) => <option key={ingredient.inventory_id} value={ingredient.inventory_id}>{ingredient.ingredient_name} ({ingredient.unit})</option>)}
                  </select>
                </label>
                <label className="block text-xs font-bold text-[#6f5d4e]">Quantity per item
                  <div className="mt-1 flex overflow-hidden rounded-lg border border-[#e3d6ca] bg-white"><input type="number" min="0.001" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full min-w-0 px-3 py-2.5 text-sm font-normal outline-none" /><span className="self-center px-2 text-xs text-[#8b7766]">{inventoryById.get(Number(ingredientId))?.unit ?? "unit"}</span></div>
                </label>
                <button onClick={() => void saveRecipe()} disabled={saving || availableIngredients.length === 0} className="rounded-lg bg-[#7c4a1e] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? "SavingÃ¢â‚¬Â¦" : editing ? "Save" : "Add"}</button>
              </div>
              {editing && <button onClick={() => { setEditing(null); setIngredientId(""); setQuantity(""); setError(""); }} className="mt-3 text-xs font-semibold text-[#7c4a1e]">Cancel edit</button>}
              {availableIngredients.length === 0 && !editing && <p className="mt-2 text-xs text-[#8b7766]">Add ingredients in Inventory Management first.</p>}
            </div>}
            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
          </div>
        </section>
      </div>}
    </section>
  );
}
