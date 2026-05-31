import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { fetchConversations } from "../../shared/api/chat";
import { apiRequest } from "../../shared/api/client";
import { Footer } from "./Footer";
import { UserNavProfile } from "./UserNavProfile";

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [hasNewReports, setHasNewReports] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const lastReportsFingerprintRef = useRef("");

  useEffect(() => {
    function handleUnauthorized() {
      const shouldRedirect = isAuthenticated;
      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsAdmin(false);
      setUnreadChats(0);
      setPendingReportsCount(0);
      if (shouldRedirect) {
        navigate("/login", { replace: true });
      }
    }

    window.addEventListener("smartboard:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("smartboard:unauthorized", handleUnauthorized);
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      try {
        const me = await apiRequest("/auth/me");
        if (!mounted) {
          return;
        }
        setIsAuthenticated(true);
        setCurrentUser(me);
        setIsAdmin(me?.role === "admin");
      } catch {
        if (!mounted) {
          return;
        }
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAdmin(false);
      }
    }

    loadRole();
    window.addEventListener("smartboard:auth-changed", loadRole);
    return () => {
      mounted = false;
      window.removeEventListener("smartboard:auth-changed", loadRole);
    };
  }, []);

  useEffect(() => {
    setIsNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isNavOpen) {
      return undefined;
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsNavOpen(false);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isNavOpen]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    let active = true;
    const intervalId = window.setInterval(async () => {
      if (!active) {
        return;
      }
      try {
        await apiRequest("/auth/me");
      } catch {
        // apiRequest will dispatch smartboard:unauthorized on 401
      }
    }, 8000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated]);

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
    if (location.pathname === "/admin") {
      setHasNewReports(false);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isAdmin) {
      setHasNewReports(false);
      setPendingReportsCount(0);
      lastReportsFingerprintRef.current = "";
      return undefined;
    }

    let mounted = true;

    async function pollReports() {
      try {
        const payload = await apiRequest("/admin/reports?limit=30&offset=0");
        if (!mounted) {
          return;
        }
        const nextItems = payload?.items ?? [];
        const pendingItems = nextItems.filter((r) => (r.status ?? "pending") === "pending");
        const nextCount = pendingItems.length;
        const nextFingerprint = pendingItems
          .slice(0, 10)
          .map((r) => `${r.id ?? r.listing_id}:${r.user_id ?? "0"}:${r.created_at}`)
          .join("|");
        const previousFingerprint = lastReportsFingerprintRef.current;
        setPendingReportsCount(nextCount);
        if (
          previousFingerprint &&
          nextFingerprint &&
          nextFingerprint !== previousFingerprint &&
          location.pathname !== "/admin"
        ) {
          setHasNewReports(true);
        }
        lastReportsFingerprintRef.current = nextFingerprint;
      } catch {
        if (!mounted) {
          return;
        }
      }
    }

    pollReports();
    const intervalId = window.setInterval(pollReports, 8000);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [isAdmin, location.pathname]);

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
      setCurrentUser(null);
      setIsAdmin(false);
      setUnreadChats(0);
      setPendingReportsCount(0);
      window.dispatchEvent(new CustomEvent("smartboard:auth-changed"));
      navigate("/login", { replace: true });
    }
  }

  function closeNav() {
    setIsNavOpen(false);
  }

  return (
    <div className="app-shell">
      <header className={`app-shell__header${isNavOpen ? " app-shell__header--menu-open" : ""}`}>
        <div className="app-shell__header-bar">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `app-shell__brand${isActive ? " app-shell__brand--active" : ""}`}
            onClick={closeNav}
          >
            SmartBoard
          </NavLink>

          <button
            type="button"
            className="app-shell__menu-toggle"
            aria-expanded={isNavOpen}
            aria-controls="app-shell-nav"
            onClick={() => setIsNavOpen((prev) => !prev)}
          >
            <span className="app-shell__menu-toggle-icon" aria-hidden="true" />
            <span className="visually-hidden">{isNavOpen ? "Закрыть меню" : "Открыть меню"}</span>
          </button>
        </div>

        {isNavOpen ? (
          <button type="button" className="app-shell__backdrop" aria-label="Закрыть меню" onClick={closeNav} />
        ) : null}

        <nav id="app-shell-nav" className={`app-shell__nav${isNavOpen ? " is-open" : ""}`}>
          {isAuthenticated ? (
            <NavLink to="/ads/new" end className="app-shell__nav-link" onClick={closeNav}>
              Разместить
            </NavLink>
          ) : null}
          {isAuthenticated ? (
            <NavLink to="/chat" end className="app-shell__nav-link app-shell__nav-item" onClick={closeNav}>
              Чаты
              {unreadChats > 0 ? (
                <span className="app-shell__badge" aria-label={`Непрочитанных: ${unreadChats}`} />
              ) : null}
            </NavLink>
          ) : null}
          {isAuthenticated ? (
            <div className="app-shell__nav-profile">
              <UserNavProfile
                user={currentUser}
                isAdmin={isAdmin}
                pendingReportsCount={pendingReportsCount}
                onLogout={() => {
                  closeNav();
                  handleLogout();
                }}
              />
            </div>
          ) : (
            <>
              <NavLink to="/login" className="app-shell__nav-link" onClick={closeNav}>
                Вход
              </NavLink>
              <NavLink to="/register" className="app-shell__nav-link" onClick={closeNav}>
                Регистрация
              </NavLink>
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
