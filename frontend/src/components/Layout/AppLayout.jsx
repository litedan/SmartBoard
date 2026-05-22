import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { apiRequest } from "../../shared/api/client";

export function AppLayout() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      try {
        const me = await apiRequest("/auth/me");
        if (!mounted) {
          return;
        }
        setIsAuthenticated(true);
        setIsAdmin(me?.role === "admin");
      } catch {
        if (!mounted) {
          return;
        }
        setIsAuthenticated(false);
        setIsAdmin(false);
      }
    }

    loadRole();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setIsAuthenticated(false);
      setIsAdmin(false);
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__brand">SmartBoard</div>
        <nav className="app-shell__nav">
          <NavLink to="/" end>
            Главная
          </NavLink>
          {isAuthenticated ? <NavLink to="/ads/new">Разместить</NavLink> : null}
          {isAuthenticated ? <NavLink to="/profile">Кабинет</NavLink> : null}
          {isAdmin ? <NavLink to="/admin">Админ</NavLink> : null}
          {isAuthenticated ? (
            <button type="button" className="app-shell__nav-button" onClick={handleLogout}>
              Выход
            </button>
          ) : (
            <>
              <NavLink to="/login">Вход</NavLink>
              <NavLink to="/register">Регистрация</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="app-shell__content">
        <Outlet />
      </main>
      <footer className="app-shell__footer">
        <p>SmartBoard · аналог доски объявлений в стиле маркетплейса</p>
      </footer>
    </div>
  );
}
