import { useEffect, useState } from "react";

import { Button } from "../UI/Button";
import { fetchAdCategories } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";
import { addSearchHistory, clearSearchHistory, getSearchHistory } from "../../shared/searchHistory";

const DEFAULT_FILTERS = {
  query: "",
  categoryId: "",
  priceMin: "",
  priceMax: "",
};

export function SearchFilters({ value = DEFAULT_FILTERS, onApply }) {
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [categories, setCategories] = useState([]);
  const [history, setHistory] = useState(() => getSearchHistory());
  const [historyPick, setHistoryPick] = useState("");
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

  function applyFilters(nextDraft) {
    onApply?.({
      query: nextDraft.query.trim(),
      categoryId: nextDraft.categoryId,
      priceMin: nextDraft.priceMin,
      priceMax: nextDraft.priceMax,
    });
  }

  function handleQueryChange(event) {
    const query = event.target.value;
    const nextDraft = { ...draft, query };
    setDraft(nextDraft);

    if (!query.trim()) {
      applyFilters(nextDraft);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    const trimmedQuery = draft.query.trim();
    if (trimmedQuery) {
      setHistory(addSearchHistory(trimmedQuery));
    }
    applyFilters(draft);
  }

  function handleHistorySelect(event) {
    const term = event.target.value;
    if (!term) {
      setHistoryPick("");
      return;
    }
    const nextDraft = { ...draft, query: term };
    setDraft(nextDraft);
    setHistory(addSearchHistory(term));
    applyFilters(nextDraft);
    setHistoryPick("");
  }

  function handleClearHistory() {
    clearSearchHistory();
    setHistory([]);
    setHistoryPick("");
  }

  return (
    <section className="home-search" aria-label="Поиск объявлений">
      <div className="home-search__head">
        <h2>Поиск объявлений</h2>
      </div>

      <form className="home-search__form" onSubmit={handleSubmit}>
        <label className="home-search__field home-search__field--wide">
          Что ищете?
          <input
            type="search"
            placeholder="Например: iPhone, ремонт"
            value={draft.query}
            onChange={handleQueryChange}
            list="search-history-suggestions"
          />
          {history.length > 0 ? (
            <datalist id="search-history-suggestions">
              {history.map((term) => (
                <option key={term} value={term} />
              ))}
            </datalist>
          ) : null}
        </label>

        {history.length > 0 ? (
          <label className="home-search__field home-search__field--history">
            История
            <div className="home-search__history-row">
              <select value={historyPick} onChange={handleHistorySelect} className="home-search__history-select">
                <option value="">Выберите запрос</option>
                {history.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
              <button type="button" className="home-search__history-clear" onClick={handleClearHistory}>
                Очистить
              </button>
            </div>
          </label>
        ) : null}

        <label className="home-search__field">
          Категория
          <select
            value={draft.categoryId}
            onChange={(event) => setDraft((prev) => ({ ...prev, categoryId: event.target.value }))}
            disabled={isLoadingCategories}
          >
            <option value="">Все</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="home-search__field">
          От, ₽
          <input
            type="number"
            min="0"
            value={draft.priceMin}
            onChange={(event) => setDraft((prev) => ({ ...prev, priceMin: event.target.value }))}
            placeholder="0"
          />
        </label>

        <label className="home-search__field">
          До, ₽
          <input
            type="number"
            min="0"
            value={draft.priceMax}
            onChange={(event) => setDraft((prev) => ({ ...prev, priceMax: event.target.value }))}
            placeholder="∞"
          />
        </label>

        <Button type="submit" variant="primary" className="home-search__submit">
          Найти
        </Button>
      </form>

      {error ? <p className="home-search__preview home-search__preview--error">{error}</p> : null}
    </section>
  );
}
