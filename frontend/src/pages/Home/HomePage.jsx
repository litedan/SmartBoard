import { Link } from "react-router-dom";

import "./home.css";

import { AdsFeed } from "../../components/Ads/AdsFeed";
import { RecommendationsBlock } from "../../components/Recommendations/RecommendationsBlock";
import { SearchFilters } from "../../components/Search/SearchFilters";

export function HomePage() {
  const highlights = [
    { value: "12 500+", label: "активных объявлений" },
    { value: "1 800", label: "новых за неделю" },
    { value: "98%", label: "ответов в первые 24 часа" },
  ];

  return (
    <section className="home-page">
      <div className="home-hero">
        <div className="home-hero__content">
          <p className="home-eyebrow">SMARTBOARD</p>
          <h1>Удобная доска объявлений для города и района</h1>
          <p className="home-hero__lead">
            Находите товары, услуги и специалистов рядом. Размещайте объявления за пару минут и
            получайте отклики от реальных людей.
          </p>
          <div className="home-hero__actions">
            <Link className="home-button home-button--primary" to="/ads/new">
              Разместить объявление
            </Link>
            <Link className="home-button home-button--ghost" to="/profile">
              Перейти в кабинет
            </Link>
          </div>
          <div className="home-metrics" aria-label="Ключевые показатели SmartBoard">
            {highlights.map((item) => (
              <article key={item.label} className="home-metric-card">
                <p className="home-metric-card__value">{item.value}</p>
                <p className="home-metric-card__label">{item.label}</p>
              </article>
            ))}
          </div>
        </div>

        <aside className="home-hero__panel" aria-label="Популярные запросы">
          <h2>Что чаще ищут сегодня</h2>
          <ul>
            <li>Ремонт квартир</li>
            <li>Ноутбуки и комплектующие</li>
            <li>Репетиторы по английскому</li>
            <li>Аренда велосипедов</li>
            <li>Доставка и грузоперевозки</li>
          </ul>
          <p>Обновлено сегодня в 10:30</p>
        </aside>
      </div>

      <SearchFilters />

      <div className="home-content-grid">
        <AdsFeed />
        <RecommendationsBlock />
      </div>
    </section>
  );
}
