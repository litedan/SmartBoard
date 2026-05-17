import { NavLink, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">SmartBoard</div>
        <nav className="app-shell__nav">
          <NavLink to="/" end>
            Главная
          </NavLink>
          <NavLink to="/profile">Кабинет</NavLink>
          <NavLink to="/login">Вход</NavLink>
          <NavLink to="/register">Регистрация</NavLink>
        </nav>
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
    </div>
  );
}
