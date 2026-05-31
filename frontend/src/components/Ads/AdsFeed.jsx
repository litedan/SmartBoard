import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { addFavorite, fetchAds, removeFavorite } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";
import { Button } from "../UI/Button";

const PAGE_SIZE = 4;

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "Цена не указана";
  }
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "Цена не указана";
  }
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ₽`;
}

function formatPublished(dateString) {
  if (!dateString) {
    return "Дата не указана";
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "Дата не указана";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getImageAlt(ad) {
  if (!ad?.title) {
    return "Изображение объявления";
  }
  return `Фото: ${ad.title}`;
}

export function AdsFeed({ filters }) {
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [favoritePendingId, setFavoritePendingId] = useState(null);
  const hasLoadedOnceRef = useRef(false);

  const totalPages = useMemo(() => {
    if (!total) {
      return 1;
    }
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [total]);

  const loadAds = useCallback(async () => {
    const offset = (page - 1) * PAGE_SIZE;
    const isFirstLoad = !hasLoadedOnceRef.current;

    if (isFirstLoad) {
      setIsInitialLoading(true);
    } else {
      setIsFetching(true);
    }
    setError(null);

    try {
      const payload = await fetchAds({
        limit: PAGE_SIZE,
        offset,
        query: filters?.query,
        categoryId: filters?.categoryId,
        priceMin: filters?.priceMin,
        priceMax: filters?.priceMax,
      });

      const nextItems = payload?.items ?? [];
      setTotal(payload?.meta?.total ?? 0);
      setAds(nextItems);
      hasLoadedOnceRef.current = true;
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Не удалось загрузить объявления");
      }
    } finally {
      setIsInitialLoading(false);
      setIsFetching(false);
    }
  }, [filters?.categoryId, filters?.priceMax, filters?.priceMin, filters?.query, page]);

  // Сбрасываем страницу на 1 при изменении фильтров.
  useEffect(() => {
    setPage(1);
    hasLoadedOnceRef.current = false;
  }, [filters?.categoryId, filters?.priceMax, filters?.priceMin, filters?.query]);

  useEffect(() => {
    loadAds();
  }, [loadAds]);

  async function toggleFavorite(ad) {
    setFavoritePendingId(ad.id);
    try {
      if (ad.is_favorite) {
        await removeFavorite(ad.id);
        setAds((prev) => prev.map((item) => (item.id === ad.id ? { ...item, is_favorite: false } : item)));
      } else {
        await addFavorite(ad.id);
        setAds((prev) => prev.map((item) => (item.id === ad.id ? { ...item, is_favorite: true } : item)));
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось обновить избранное");
    } finally {
      setFavoritePendingId(null);
    }
  }

  return (
    <section className="home-feed" aria-label="Лента объявлений">
      <div className="home-feed__head">
        <h2>Объявления</h2>
      </div>

      <div className={`home-feed__list${isFetching ? " home-feed__list--fetching" : ""}`}>
        {isInitialLoading ? <p className="home-feed__status">⏳ Загрузка...</p> : null}
        {error ? <p className="home-feed__status home-feed__status--error">{error}</p> : null}
        {!isInitialLoading && !error && ads.length === 0 ? (
          <p className="home-feed__status">🔍 Ничего не найдено</p>
        ) : null}
        {!isInitialLoading && !error
          ? ads.map((ad, index) => (
              <article
                className="home-ad-card"
                key={ad.id}
                style={{ animationDelay: `${index * 40}ms` }}
                role="link"
                tabIndex={0}
                aria-label={`Открыть ${ad.title}`}
                onClick={() => navigate(`/ads/${ad.id}`)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/ads/${ad.id}`);
                  }
                }}
              >
                <div className="home-ad-card__image-wrap" aria-hidden="true">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={getImageAlt(ad)} className="home-ad-card__image" loading="lazy" />
                  ) : (
                    <div className="home-ad-card__image-placeholder" aria-hidden="true">
                      <span>📷</span>
                    </div>
                  )}
                </div>
                <div className="home-ad-card__meta">
                  {ad.category_id ? (
                    <Link
                      to={`/?categoryId=${ad.category_id}`}
                      className="home-ad-card__category-link"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {ad.category_name ?? "Категория"}
                    </Link>
                  ) : (
                    <span>Без категории</span>
                  )}
                  <button
                    type="button"
                    className={`home-ad-card__fav ${ad.is_favorite ? "active" : ""}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(ad);
                    }}
                    disabled={favoritePendingId === ad.id}
                    aria-label={ad.is_favorite ? "Убрать из избранного" : "В избранное"}
                  >
                    {ad.is_favorite ? "❤️" : "🤍"}
                  </button>
                </div>
                <h3>
                  <span>{ad.title}</span>
                </h3>
                <p className="home-ad-card__price">{formatPrice(ad.price)}</p>
                <p className="home-ad-card__location">👤 {ad.author_name ?? "Продавец"}</p>
                <p className="home-ad-card__published">🕒 {formatPublished(ad.created_at)}</p>
              </article>
            ))
          : null}
      </div>

      {!isInitialLoading && !error && totalPages > 1 ? (
        <div className="home-pagination" aria-label="Пагинация" aria-busy={isFetching}>
          <Button
            type="button"
            variant="secondary"
            className="home-pagination__btn"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => p - 1)}
          >
            ← Назад
          </Button>
          <span className="home-pagination__info">
            Страница {page} из {totalPages}
            {isFetching ? " · обновление..." : ""}
          </span>
          <Button
            type="button"
            variant="secondary"
            className="home-pagination__btn"
            disabled={page >= totalPages || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд →
          </Button>
        </div>
      ) : null}
    </section>
  );
}
