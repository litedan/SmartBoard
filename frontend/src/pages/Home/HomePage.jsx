import { useEffect, useState } from "react";

import "./home.css";

import { AdsFeed } from "../../components/Ads/AdsFeed";
import { Button } from "../../components/UI/Button";
import { SearchFilters } from "../../components/Search/SearchFilters";
import { apiRequest } from "../../shared/api/client";

export function HomePage() {
  const [filters, setFilters] = useState({
    query: "",
    categoryId: "",
    priceMin: "",
    priceMax: "",
  });
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      try {
        await apiRequest("/auth/me");
        if (mounted) {
          setIsAuthenticated(true);
        }
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
        }
      }
    }

    loadAuth();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <section className="home-page">
      <div className="home-hero-compact">
        <div>
          <h1>Объявления рядом с вами</h1>
          <p className="home-hero-compact__lead">Покупайте и продавайте без лишних шагов</p>
        </div>
        <div className="home-hero-compact__actions">
          {isAuthenticated ? (
            <Button to="/ads/new" variant="primary">
              Разместить объявление
            </Button>
          ) : (
            <Button to="/login" variant="primary">
              Войти и разместить
            </Button>
          )}
          <Button to={isAuthenticated ? "/profile" : "/register"} variant="secondary">
            {isAuthenticated ? "Кабинет" : "Регистрация"}
          </Button>
        </div>
      </div>

      <SearchFilters value={filters} onApply={setFilters} />
      <AdsFeed filters={filters} />
    </section>
  );
}
