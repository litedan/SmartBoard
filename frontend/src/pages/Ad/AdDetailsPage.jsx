import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { addFavorite, fetchAdById, removeFavorite } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";
import "./ad.css";

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

function formatDate(value) {
  if (!value) {
    return "Дата не указана";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Дата не указана";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function getListingStatus(ad) {
  if (ad.is_active) {
    return ad.quantity_total > 1 ? "В наличии" : "Активно";
  }
  if (ad.quantity_total > 1) {
    return ad.quantity_available === 0 ? "Распродано" : "Продажи остановлены";
  }
  return "Услуга оказана";
}

export function AdDetailsPage() {
  const navigate = useNavigate();
  const { adId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const [ad, setAd] = useState(null);
  const [error, setError] = useState(null);

  const numericAdId = useMemo(() => Number(adId), [adId]);

  useEffect(() => {
    let mounted = true;

    async function loadAd() {
      if (!Number.isInteger(numericAdId) || numericAdId <= 0) {
        setError("Некорректный ID объявления");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const payload = await fetchAdById(numericAdId);
        if (!mounted) {
          return;
        }
        setAd(payload);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        if (requestError instanceof ApiError) {
          if (requestError.status === 404) {
            setError("Объявление не найдено");
          } else {
            setError(requestError.message);
          }
        } else {
          setError("Не удалось загрузить объявление");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadAd();
    return () => {
      mounted = false;
    };
  }, [numericAdId]);

  if (isLoading) {
    return (
      <section className="ad-page">
        <p className="ad-status">Загружаем объявление...</p>
      </section>
    );
  }

  if (error || !ad) {
    return (
      <section className="ad-page">
        <article className="ad-card">
          <p className="ad-status ad-status--error">{error ?? "Объявление не найдено"}</p>
          <button type="button" className="ad-button ad-button--ghost" onClick={() => navigate("/")}>
            На главную
          </button>
        </article>
      </section>
    );
  }

  async function toggleFavorite() {
    setIsFavoritePending(true);
    try {
      if (ad.is_favorite) {
        await removeFavorite(ad.id);
        setAd((prev) => (prev ? { ...prev, is_favorite: false } : prev));
      } else {
        await addFavorite(ad.id);
        setAd((prev) => (prev ? { ...prev, is_favorite: true } : prev));
      }
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось обновить избранное");
    } finally {
      setIsFavoritePending(false);
    }
  }

  const breadcrumbs = [{ label: "Каталог", to: "/" }, { label: ad.title }];
  const statusLabel = getListingStatus(ad);

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <section className="ad-page">
        <article className="ad-card">
          <button type="button" className="ad-back-button" onClick={() => navigate(-1)}>
            <span aria-hidden="true">←</span>
            <span>Назад</span>
          </button>
          <div className="ad-card__top">
            <span>{ad.category_name ?? "Без категории"}</span>
            <span className={`ad-status-chip ${ad.is_active ? "ad-status-chip--active" : "ad-status-chip--inactive"}`}>
              {statusLabel}
            </span>
          </div>
          <h1>{ad.title}</h1>
          <p className="ad-card__price">{formatPrice(ad.price)}</p>
          <p className="ad-card__description">{ad.description}</p>
          {ad.image_url ? (
            <div className="ad-card__image-wrap">
              <img src={ad.image_url} alt={ad.title} className="ad-card__image" />
              <a className="ad-card__image-link" href={ad.image_url} target="_blank" rel="noreferrer">
                Открыть изображение в новой вкладке
              </a>
            </div>
          ) : null}
          <div className="ad-card__meta">
            <p>
              Автор:{" "}
              <Link to={`/users/${ad.user_id}`} className="ad-inline-link">
                {ad.author_name ?? "Пользователь SmartBoard"}
              </Link>
            </p>
            <p>
              Связаться:{" "}
              <Link className="ad-inline-link" to={`/chat?listingId=${ad.id}`}>
                Написать в чат
              </Link>
            </p>
            {ad.quantity_total > 1 ? (
              <p>
                Остаток: {ad.quantity_available} из {ad.quantity_total}
              </p>
            ) : null}
            <p>Опубликовано: {formatDate(ad.created_at)}</p>
          </div>
          <div className="ad-card__actions">
            <button
              type="button"
              className="ad-button ad-button--primary"
              disabled={isFavoritePending}
              onClick={toggleFavorite}
            >
              {ad.is_favorite ? "❤️ В избранном" : "🤍 В избранное"}
            </button>
            <Link to={`/chat?listingId=${ad.id}`} className="ad-button ad-button--accent">
              Открыть чат с автором
            </Link>
            <Link to="/" className="ad-button ad-button--ghost">
              К каталогу
            </Link>
            <Link to={`/users/${ad.user_id}`} className="ad-button ad-button--ghost">
              Профиль продавца
            </Link>
          </div>
        </article>
      </section>
    </>
  );
}
