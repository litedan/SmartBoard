import { useEffect, useMemo, useState } from "react";

import { fetchAdCategories } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";

const DEFAULT_FILTERS = {
  query: "",
  categoryId: "",
  priceMin: "",
  priceMax: "",
};

export function SearchFilters({ value = DEFAULT_FILTERS, onApply }) {
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [categories, setCategories] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft({
      query: value?.query ?? "",
      categoryId: value?.categoryId ?? "",
      priceMin: value?.priceMin ?? "",
      priceMax: value?.priceMax ?? "",
    });
  }, [value]);

  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      setIsLoadingCategories(true);
      setError("");
      try {
        const payload = await fetchAdCategories();
        if (!mounted) {
          return;
        }
        setCategories(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        if (requestError instanceof ApiError) {
          setError(requestError.message);
        } else {
          setError("Не удалось загрузить категории");
        }
      } finally {
        if (mounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  const previewText = useMemo(() => {
    const category = categories.find((item) => String(item.id) === String(draft.categoryId));
    const categoryLabel = category?.name ?? "все категории";
    const queryLabel = draft.query.trim() ? `по запросу «${draft.query.trim()}»` : "без ключевого слова";
    const priceLabel =
      draft.priceMin || draft.priceMax
        ? `цена: ${draft.priceMin || "0"} - ${draft.priceMax || "∞"} ₽`
        : "без фильтра по цене";
    return `${categoryLabel}, ${priceLabel}, ${queryLabel}`;
  }, [categories, draft.categoryId, draft.priceMax, draft.priceMin, draft.query]);

  function handleSubmit(event) {
    event.preventDefault();
    onApply?.({
      query: draft.query.trim(),
      categoryId: draft.categoryId,
      priceMin: draft.priceMin,
      priceMax: draft.priceMax,
    });
  }

  return (
    <section className="home-search" aria-label="Поиск объявлений">
      <div className="home-search__head">
        <h2>Найдите нужное объявление</h2>
        <p>Поиск работает по базе объявлений в реальном времени.</p>
      </div>

      <form className="home-search__form" onSubmit={handleSubmit}>
        <label className="home-search__field home-search__field--wide">
          Что ищете?
          <input
            type="text"
            placeholder="Например: iPhone 14, мастер по плитке"
            value={draft.query}
            onChange={(event) => setDraft((prev) => ({ ...prev, query: event.target.value }))}
          />
        </label>

        <label className="home-search__field">
          Категория
          <select
            value={draft.categoryId}
            onChange={(event) => setDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
            disabled={isLoadingCategories}
          >
            <option value="">Все категории</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="home-search__field">
          Цена от
          <input
            type="number"
            min="0"
            value={draft.priceMin}
            onChange={(event) => setDraft((prev) => ({ ...prev, priceMin: event.target.value }))}
            placeholder="0"
          />
        </label>

        <label className="home-search__field">
          Цена до
          <input
            type="number"
            min="0"
            value={draft.priceMax}
            onChange={(event) => setDraft((prev) => ({ ...prev, priceMax: event.target.value }))}
            placeholder="100000"
          />
        </label>

        <button type="submit" className="home-button home-button--primary home-search__submit">
          Показать предложения
        </button>
      </form>

      {error ? <p className="home-search__preview home-search__preview--error">{error}</p> : null}
      <p className="home-search__preview">Предпросмотр фильтра: {previewText}</p>
    </section>
  );
}
