import { Link } from "react-router-dom";

const CATEGORY_INSIGHTS = [
  { title: "Техника", growth: "+28% за неделю", details: "Смартфоны и ноутбуки" },
  { title: "Услуги", growth: "+17% за неделю", details: "Ремонт и обучение" },
  { title: "Недвижимость", growth: "+11% за неделю", details: "Аренда и продажа" },
];

export function RecommendationsBlock() {
  return (
    <aside className="home-recommendations" aria-label="Рекомендации">
      <section className="home-recommendations__card">
        <h2>Рекомендации для вас</h2>
        <p>Заполните профиль и получите персональные подборки объявлений.</p>
        <Link to="/register" className="home-button home-button--ghost home-recommendations__cta">
          Создать аккаунт
        </Link>
      </section>

      <section className="home-recommendations__card">
        <h3>Тренды категорий</h3>
        <ul className="home-recommendations__list">
          {CATEGORY_INSIGHTS.map((item) => (
            <li key={item.title}>
              <div>
                <p>{item.title}</p>
                <small>{item.details}</small>
              </div>
              <strong>{item.growth}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="home-recommendations__card home-recommendations__card--tips">
        <h3>Безопасная сделка</h3>
        <ul>
          <li>Проверяйте профиль и историю пользователя.</li>
          <li>Не переводите предоплату незнакомым людям.</li>
          <li>Общайтесь в чате SmartBoard.</li>
        </ul>
      </section>
    </aside>
  );
}
