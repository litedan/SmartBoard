import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { addFavorite, fetchAds, removeFavorite } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";

const PAGE_SIZE = 12;

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

export function AdsFeed({ filters }) {
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [favoritePendingId, setFavoritePendingId] = useState(null);

  const sentinelRef = useRef(null);

  const hasMore = useMemo(() => ads.length < total, [ads.length, total]);

  const loadAds = useCallback(
    async ({ append, offset }) => {
      const nextOffset = append ? offset ?? 0 : 0;
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      try {
        const payload = await fetchAds({
          limit: PAGE_SIZE,
          offset: nextOffset,
          query: filters?.query,
          categoryId: filters?.categoryId,
          priceMin: filters?.priceMin,
          priceMax: filters?.priceMax,
        });

        const nextItems = payload?.items ?? [];
        setTotal(payload?.meta?.total ?? 0);
        setAds((prev) => (append ? [...prev, ...nextItems] : nextItems));
      } catch (requestError) {
        if (requestError instanceof ApiError) {
          setError(requestError.message);
        } else {
          setError("Не удалось загрузить объявления");
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [filters?.categoryId, filters?.priceMax, filters?.priceMin, filters?.query],
  );

  useEffect(() => {
    loadAds({ append: false, offset: 0 });
  }, [filters?.categoryId, filters?.priceMax, filters?.priceMin, filters?.query, loadAds]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || isLoading || isLoadingMore || !hasMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          loadAds({ append: true, offset: ads.length });
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [ads.length, hasMore, isLoading, isLoadingMore, loadAds]);

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
        <h2>Свежие объявления</h2>
        <p>Публикации из базы данных SmartBoard.</p>
      </div>

      <div className="home-feed__list">
        {isLoading ? <p className="home-feed__status">Загружаем объявления...</p> : null}
        {error ? <p className="home-feed__status home-feed__status--error">{error}</p> : null}
        {!isLoading && !error && ads.length === 0 ? (
          <p className="home-feed__status">По вашему фильтру ничего не найдено.</p>
        ) : null}
        {!isLoading && !error
          ? ads.map((ad, index) => (
              <article className="home-ad-card" key={ad.id} style={{ animationDelay: `${index * 40}ms` }}>
                <div className="home-ad-card__meta">
                  <span>{ad.category_name ?? "Без категории"}</span>
                  <button
                    type="button"
                    className={`home-ad-card__fav ${ad.is_favorite ? "active" : ""}`}
                    onClick={() => toggleFavorite(ad)}
                    disabled={favoritePendingId === ad.id}
                  >
                    {ad.is_favorite ? "В избранном" : "В избранное"}
                  </button>
                </div>
                <h3>
                  <Link to={`/ads/${ad.id}`}>{ad.title}</Link>
                </h3>
                <p className="home-ad-card__price">{formatPrice(ad.price)}</p>
                <p className="home-ad-card__location">{ad.author_name ?? "Пользователь SmartBoard"}</p>
                <p className="home-ad-card__published">{formatPublished(ad.created_at)}</p>
              </article>
            ))
          : null}
      </div>

      {!isLoading && hasMore ? <div ref={sentinelRef} className="home-feed__sentinel" /> : null}
      {isLoadingMore ? <p className="home-feed__status">Загружаем ещё...</p> : null}
    </section>
  );
}
