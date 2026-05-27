import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { fetchConversations } from "../../shared/api/chat";
import { apiRequest } from "../../shared/api/client";
import { Footer } from "./Footer";

export function AppLayout() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadChats(0);
      return undefined;
    }

    let mounted = true;

    async function loadUnread() {
      try {
        const payload = await fetchConversations();
        if (!mounted) {
          return;
        }
        const total = (payload?.items ?? []).reduce((sum, item) => sum + (item.unread_count ?? 0), 0);
        setUnreadChats(total);
      } catch {
        if (!mounted) {
          return;
        }
        setUnreadChats(0);
      }
    }

    loadUnread();
    const intervalId = window.setInterval(loadUnread, 12000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    function updateVisibility() {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      if (!isMobile) {
        setShowScrollTop(false);
        return;
      }

      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight;
      const winHeight = window.innerHeight;
      const distanceFromBottom = docHeight - (scrollTop + winHeight);

      // Показываем кнопку, когда пользователь почти внизу страницы.
      setShowScrollTop(distanceFromBottom < 160);
    }

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  async function handleLogout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setIsAuthenticated(false);
      setIsAdmin(false);
      setUnreadChats(0);
      navigate("/login", { replace: true });
    }
  }

  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <NavLink to="/" className="app-shell__brand">
          SmartBoard
        </NavLink>
        <nav className="app-shell__nav">
          {isAuthenticated ? (
            <NavLink to="/ads/new" end>
              Разместить
            </NavLink>
          ) : null}
          {isAuthenticated ? (
            <NavLink to="/chat" end className="app-shell__nav-item">
              Чаты
              {unreadChats > 0 ? (
                <span className="app-shell__badge" aria-label={`Непрочитанных: ${unreadChats}`} />
              ) : null}
            </NavLink>
          ) : null}
          {isAuthenticated ? (
            <NavLink to="/profile" end>
              Кабинет
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/admin" end>
              Админ
            </NavLink>
          ) : null}
          {isAuthenticated ? (
            <button type="button" className="sb-btn sb-btn--ghost sb-btn--sm" onClick={handleLogout}>
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
      <Footer />
      {showScrollTop ? (
        <button
          type="button"
          className="sb-scroll-top"
          aria-label="Наверх"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          ↑
        </button>
      ) : null}
    </div>
  );
}
