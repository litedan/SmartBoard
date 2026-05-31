import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

function getDisplayName(user) {
  if (!user) {
    return "Пользователь";
  }
  const parts = [user.name, user.last_name].filter(Boolean);
  return parts.join(" ").trim() || user.email || "Пользователь";
}

function getInitial(user) {
  const source = user?.name || user?.email || "?";
  return source.charAt(0).toUpperCase();
}

function getRoleLabel(role) {
  if (role === "admin") {
    return "Админ";
  }
  return "Пользователь";
}

export function UserNavProfile({ user, isAdmin, onLogout, pendingReportsCount = 0 }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  if (!user) {
    return null;
  }

  const displayName = getDisplayName(user);
  const roleLabel = getRoleLabel(user.role);

  return (
    <div className={`user-nav${isOpen ? " user-nav--open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="user-nav__trigger"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className="user-nav__avatar" aria-hidden="true">
          {user.avatar_url ? <img src={user.avatar_url} alt="" /> : getInitial(user)}
        </span>
        <span className="user-nav__info">
          <span className="user-nav__name">{displayName}</span>
          <span className={`user-nav__role${user.role === "admin" ? " user-nav__role--admin" : ""}`}>{roleLabel}</span>
        </span>
        <span className="user-nav__caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen ? (
        <div className="user-nav__menu" role="menu">
          <button
            type="button"
            className="user-nav__menu-item"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              navigate("/profile");
            }}
          >
            Личный кабинет
          </button>
          {isAdmin ? (
            <Link
              to="/admin"
              className="user-nav__menu-item user-nav__menu-item--link"
              role="menuitem"
              onClick={() => setIsOpen(false)}
            >
              Админ-панель
              {pendingReportsCount > 0 ? (
                <span className="user-nav__menu-badge">{pendingReportsCount}</span>
              ) : null}
            </Link>
          ) : null}
          <button
            type="button"
            className="user-nav__menu-item user-nav__menu-item--danger"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
          >
            Выход
          </button>
        </div>
      ) : null}
    </div>
  );
}
