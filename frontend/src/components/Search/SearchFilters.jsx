import { useEffect, useId, useRef, useState } from "react";

import { Button } from "../UI/Button";
import { fetchAdCategories, fetchAds } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";

const DEFAULT_FILTERS = {
  query: "",
  categoryId: "",
  priceMin: "",
  priceMax: "",
};
const SEARCH_HISTORY_KEY = "smartboard:search-history";
const SEARCH_HISTORY_LIMIT = 8;

export function SearchFilters({ value = DEFAULT_FILTERS, onApply }) {
  const listboxId = useId();
  const queryWrapRef = useRef(null);
  const [draft, setDraft] = useState(DEFAULT_FILTERS);
  const [categories, setCategories] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [error, setError] = useState("");
  const applyTimeoutRef = useRef(null);

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

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
      if (!raw) {
        setSearchHistory([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setSearchHistory([]);
        return;
      }
      setSearchHistory(parsed.filter((item) => typeof item === "string" && item.trim()).slice(0, SEARCH_HISTORY_LIMIT));
    } catch {
      setSearchHistory([]);
    }
  }, []);

  useEffect(() => {
    function handleOutside(event) {
      if (!queryWrapRef.current?.contains(event.target)) {
        setIsSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    const query = draft.query.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return undefined;
    }

    let mounted = true;
    const timeoutId = window.setTimeout(async () => {
      setIsLoadingSuggestions(true);
      try {
        const payload = await fetchAds({
          query,
          categoryId: draft.categoryId,
          priceMin: draft.priceMin,
          priceMax: draft.priceMax,
          limit: 6,
          offset: 0,
        });
        if (mounted) {
          setSuggestions(payload?.items ?? []);
        }
      } catch {
        if (mounted) {
          setSuggestions([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingSuggestions(false);
        }
      }
    }, 300);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [draft.query, draft.categoryId, draft.priceMin, draft.priceMax]);

  function applyFilters(nextDraft) {
    onApply?.({
      query: nextDraft.query.trim(),
      categoryId: nextDraft.categoryId,
      priceMin: nextDraft.priceMin,
      priceMax: nextDraft.priceMax,
    });
  }

  function scheduleApply(nextDraft) {
    if (applyTimeoutRef.current) {
      window.clearTimeout(applyTimeoutRef.current);
    }
    applyTimeoutRef.current = window.setTimeout(() => {
      applyFilters(nextDraft);
    }, 300);
  }

  function saveQueryToHistory(query) {
    const normalized = query.trim();
    if (!normalized) {
      return;
    }
    setSearchHistory((prev) => {
      const next = [normalized, ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(
        0,
        SEARCH_HISTORY_LIMIT,
      );
      try {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      } catch {
        // ignore localStorage errors
      }
      return next;
    });
  }

  function handleQueryChange(event) {
    const query = event.target.value;
    const nextDraft = { ...draft, query };
    setDraft(nextDraft);
    setIsSuggestionsOpen(true);
    if (!query.trim()) {
      setSuggestions([]);
    }
    scheduleApply(nextDraft);
  }

  function handleSubmit(event) {
    event.preventDefault();
    saveQueryToHistory(draft.query);
    setIsSuggestionsOpen(false);
    applyFilters(draft);
  }

  function handleSuggestionSelect(item) {
    const nextDraft = { ...draft, query: item.title ?? "" };
    saveQueryToHistory(nextDraft.query);
    setDraft(nextDraft);
    setIsSuggestionsOpen(false);
    applyFilters(nextDraft);
  }

  function handleHistorySelect(query) {
    const nextDraft = { ...draft, query };
    saveQueryToHistory(query);
    setDraft(nextDraft);
    setIsSuggestionsOpen(false);
    applyFilters(nextDraft);
  }

  function clearSearchHistory() {
    setSearchHistory([]);
    try {
      window.localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {
      // ignore localStorage errors
    }
  }

  const normalizedQuery = draft.query.trim().toLowerCase();
  const historyItems =
    normalizedQuery.length === 0
      ? searchHistory
      : searchHistory.filter((item) => item.toLowerCase().includes(normalizedQuery)).slice(0, SEARCH_HISTORY_LIMIT);
  const showHistory = isSuggestionsOpen && draft.query.trim().length < 2;
  const showSuggestions = isSuggestionsOpen && draft.query.trim().length >= 2;

  return (
    <section className="home-search" aria-label="Поиск объявлений">
      <div className="home-search__head">
        <h2>Поиск объявлений</h2>
      </div>

      <form className="home-search__form" onSubmit={handleSubmit}>
        <label className="home-search__field home-search__field--wide">
          Что ищете?
          <div className="home-search__query-wrap" ref={queryWrapRef}>
            <input
              type="search"
              placeholder="Например: iPhone, ремонт"
              value={draft.query}
              onChange={handleQueryChange}
              onFocus={() => setIsSuggestionsOpen(true)}
              autoComplete="off"
              role="combobox"
              aria-expanded={isSuggestionsOpen}
              aria-controls={listboxId}
              aria-autocomplete="list"
            />
            {showHistory ? (
              <ul className="home-search__suggestions" id={listboxId} role="listbox">
                <li className="home-search__suggestions-head">
                  <span>История поиска</span>
                  {searchHistory.length > 0 ? (
                    <button type="button" className="home-search__clear-history" onMouseDown={(event) => event.preventDefault()} onClick={clearSearchHistory}>
                      Очистить
                    </button>
                  ) : null}
                </li>
                {historyItems.length === 0 ? (
                  <li className="home-search__suggestions-status">История пуста</li>
                ) : (
                  historyItems.map((item) => (
                    <li key={item} role="option">
                      <button
                        type="button"
                        className="home-search__suggestion"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleHistorySelect(item)}
                      >
                        <span className="home-search__suggestion-title">🕘 {item}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
            {showSuggestions ? (
              <ul className="home-search__suggestions" id={listboxId} role="listbox">
                {isLoadingSuggestions ? (
                  <li className="home-search__suggestions-status">Поиск...</li>
                ) : suggestions.length === 0 ? (
                  <li className="home-search__suggestions-status">Ничего не найдено</li>
                ) : (
                  suggestions.map((item) => (
                    <li key={item.id} role="option">
                      <button
                        type="button"
                        className="home-search__suggestion"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => handleSuggestionSelect(item)}
                      >
                        <span className="home-search__suggestion-title">{item.title}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        </label>

        <label className="home-search__field">
          Категория
          <select
            value={draft.categoryId}
            onChange={(event) => {
              const nextDraft = { ...draft, categoryId: event.target.value };
              setDraft(nextDraft);
              scheduleApply(nextDraft);
            }}
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
            onChange={(event) => {
              const nextDraft = { ...draft, priceMin: event.target.value };
              setDraft(nextDraft);
              scheduleApply(nextDraft);
            }}
            placeholder="0"
          />
        </label>

        <label className="home-search__field">
          До, ₽
          <input
            type="number"
            min="0"
            value={draft.priceMax}
            onChange={(event) => {
              const nextDraft = { ...draft, priceMax: event.target.value };
              setDraft(nextDraft);
              scheduleApply(nextDraft);
            }}
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
