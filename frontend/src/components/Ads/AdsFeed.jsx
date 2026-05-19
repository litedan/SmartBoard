import { Link } from "react-router-dom";

const ADS = [
  {
    id: 101,
    title: "MacBook Air M2 16/512, идеальное состояние",
    price: "98 000 ₽",
    location: "Москва, Таганский",
    category: "Техника",
    badge: "Проверено",
    published: "Сегодня, 09:20",
  },
  {
    id: 102,
    title: "Диван-кровать сканди, новый текстиль",
    price: "28 500 ₽",
    location: "Казань, Вахитовский",
    category: "Для дома",
    badge: "Срочно",
    published: "Сегодня, 11:05",
  },
  {
    id: 103,
    title: "Репетитор по английскому для взрослых",
    price: "1 700 ₽ / час",
    location: "Онлайн",
    category: "Услуги",
    badge: "Топ",
    published: "Вчера, 20:11",
  },
  {
    id: 104,
    title: "Аренда фотоаппарата Sony A7 IV",
    price: "3 000 ₽ / день",
    location: "Санкт-Петербург, Петроградский",
    category: "Техника",
    badge: "Новый",
    published: "Сегодня, 13:42",
  },
  {
    id: 105,
    title: "Установка кондиционеров под ключ",
    price: "от 6 500 ₽",
    location: "Екатеринбург",
    category: "Услуги",
    badge: "Рекомендация",
    published: "Сегодня, 08:55",
  },
  {
    id: 106,
    title: "Студия 25 м² у метро, долгосрочно",
    price: "56 000 ₽ / мес",
    location: "Москва, Савеловский",
    category: "Недвижимость",
    badge: "Популярно",
    published: "Вчера, 18:09",
  },
];

export function AdsFeed() {
  return (
    <section className="home-feed" aria-label="Лента объявлений">
      <div className="home-feed__head">
        <h2>Свежие объявления</h2>
        <p>Подборка новых публикаций, которые сейчас набирают отклики.</p>
      </div>

      <div className="home-feed__list">
        {ADS.map((ad, index) => (
          <article
            className="home-ad-card"
            key={ad.id}
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="home-ad-card__meta">
              <span>{ad.category}</span>
              <span className="home-ad-card__badge">{ad.badge}</span>
            </div>
            <h3>
              <Link to={`/ads/${ad.id}`}>{ad.title}</Link>
            </h3>
            <p className="home-ad-card__price">{ad.price}</p>
            <p className="home-ad-card__location">{ad.location}</p>
            <p className="home-ad-card__published">{ad.published}</p>
          </article>
        ))}
      </div>
    </section>
  );
}