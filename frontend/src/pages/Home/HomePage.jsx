import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import "./home.css";

import { AdsFeed } from "../../components/Ads/AdsFeed";
import { Button } from "../../components/UI/Button";
import { SearchFilters } from "../../components/Search/SearchFilters";
import { apiRequest } from "../../shared/api/client";

export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    query: searchParams.get("query") ?? "",
    categoryId: searchParams.get("categoryId") ?? "",
    priceMin: searchParams.get("priceMin") ?? "",
    priceMax: searchParams.get("priceMax") ?? "",
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

  useEffect(() => {
    const nextFilters = {
      query: searchParams.get("query") ?? "",
      categoryId: searchParams.get("categoryId") ?? "",
      priceMin: searchParams.get("priceMin") ?? "",
      priceMax: searchParams.get("priceMax") ?? "",
    };
    setFilters((prev) =>
      prev.query === nextFilters.query &&
      prev.categoryId === nextFilters.categoryId &&
      prev.priceMin === nextFilters.priceMin &&
      prev.priceMax === nextFilters.priceMax
        ? prev
        : nextFilters,
    );
  }, [searchParams]);

  function handleApplyFilters(nextFilters) {
    setFilters(nextFilters);
    const nextParams = new URLSearchParams();
    if (nextFilters.query.trim()) {
      nextParams.set("query", nextFilters.query.trim());
    }
    if (String(nextFilters.categoryId).trim()) {
      nextParams.set("categoryId", String(nextFilters.categoryId).trim());
    }
    if (String(nextFilters.priceMin).trim()) {
      nextParams.set("priceMin", String(nextFilters.priceMin).trim());
    }
    if (String(nextFilters.priceMax).trim()) {
      nextParams.set("priceMax", String(nextFilters.priceMax).trim());
    }
    setSearchParams(nextParams, { replace: true });
  }

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

      <SearchFilters value={filters} onApply={handleApplyFilters} />
      <AdsFeed filters={filters} />
    </section>
  );
}
