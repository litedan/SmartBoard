import { Link } from "react-router-dom";

const FOOTER_LINKS = [
  {
    title: "Каталог",
    items: [
      { label: "Главная", to: "/" },
      { label: "Разместить", to: "/ads/new" },
    ],
  },
  {
    title: "Аккаунт",
    items: [
      { label: "Вход", to: "/login" },
      { label: "Регистрация", to: "/register" },
      { label: "Кабинет", to: "/profile" },
      { label: "Чаты", to: "/chat" },
    ],
  },
  {
    title: "Помощь",
    items: [
      { label: "Безопасная сделка", to: "/" },
      { label: "Поддержка", to: "/" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer__inner">
        <div className="app-footer__brand">
          <Link to="/" className="app-footer__logo">
            SmartBoard
          </Link>
          <p>Доска объявлений: покупка, продажа и услуги в одном месте.</p>
        </div>

        {FOOTER_LINKS.map((group) => (
          <nav key={group.title} className="app-footer__col" aria-label={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((item) => (
                <li key={item.label}>
                  <Link to={item.to}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="app-footer__bottom">
        <p>© {year} SmartBoard</p>
        <p className="app-footer__tags">
          <span>Безопасные сделки</span>
          <span>Чат с продавцом</span>
          <span>Удобный поиск</span>
        </p>
      </div>
    </footer>
  );
}
