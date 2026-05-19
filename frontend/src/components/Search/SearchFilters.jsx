import { useMemo, useState } from "react";

const CATEGORY_OPTIONS = ["Все категории", "Техника", "Недвижимость", "Услуги", "Работа", "Для дома"];
const CITY_OPTIONS = ["Москва", "Санкт-Петербург", "Казань", "Екатеринбург", "Новосибирск"];

export function SearchFilters() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(CATEGORY_OPTIONS[0]);
  const [city, setCity] = useState(CITY_OPTIONS[0]);
  const [onlyUrgent, setOnlyUrgent] = useState(false);

  const previewText = useMemo(() => {
    const categoryLabel = category === "Все категории" ? "любая категория" : category;
    const urgencyLabel = onlyUrgent ? "только срочные" : "все";
    const queryLabel = query.trim() ? `по запросу «${query.trim()}»` : "без ключевого слова";
    return `${city}, ${categoryLabel}, ${urgencyLabel}, ${queryLabel}`;
  }, [category, city, onlyUrgent, query]);

  function handleSubmit(event) {
    event.preventDefault();
  }

  return (
    <section className="home-search" aria-label="Поиск объявлений">
      <div className="home-search__head">
        <h2>Найдите нужное объявление</h2>
        <p>Гибкие фильтры помогают сразу увидеть релевантные предложения.</p>
      </div>

      <form className="home-search__form" onSubmit={handleSubmit}>
        <label className="home-search__field home-search__field--wide">
          Что ищете?
          <input
            type="text"
            placeholder="Например: iPhone 14, мастер по плитке"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label className="home-search__field">
          Категория
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="home-search__field">
          Город
          <select value={city} onChange={(event) => setCity(event.target.value)}>
            {CITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="home-search__switch" htmlFor="urgent-only">
          <input
            id="urgent-only"
            type="checkbox"
            checked={onlyUrgent}
            onChange={(event) => setOnlyUrgent(event.target.checked)}
          />
          Только срочные
        </label>

        <button type="submit" className="home-button home-button--primary home-search__submit">
          Показать предложения
        </button>
      </form>

      <p className="home-search__preview">Предпросмотр фильтра: {previewText}</p>
    </section>
  );
}