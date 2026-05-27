import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { BackButton } from "../../components/Layout/BackButton";
import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { Button } from "../../components/UI/Button";
import { useToast } from "../../components/UI/ToastProvider";
import { addFavorite, fetchAdById, fetchSimilarAds, removeFavorite } from "../../shared/api/ads";
import { apiRequest, ApiError } from "../../shared/api/client";
import { submitListingReport } from "../../shared/api/reports";
import "./ad.css";

function formatPrice(value) {
  if (value === null || value === undefined) {
    return "Договорная";
  }
  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return "Договорная";
  }
  return `${new Intl.NumberFormat("ru-RU").format(amount)} ₽`;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
}

function AdGallery({ images, title }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const safeImages = images.length > 0 ? images.slice(0, 3) : [];
  const activeImage = safeImages[activeIndex] ?? null;

  if (!activeImage) {
    return (
      <div className="ad-gallery">
        <div className="ad-gallery__main ad-gallery__main--empty">
          <span>📷</span>
          <p>Нет фото</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ad-gallery">
      <div className="ad-gallery__main">
        <img src={activeImage} alt={title} />
      </div>
      {safeImages.length > 1 ? (
        <div className="ad-gallery__thumbs">
          {safeImages.map((url, index) => (
            <button
              key={url}
              type="button"
              className={`ad-gallery__thumb ${index === activeIndex ? "active" : ""}`}
              onClick={() => setActiveIndex(index)}
            >
              <img src={url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdDetailsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { adId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isFavoritePending, setIsFavoritePending] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [ad, setAd] = useState(null);
  const [similarAds, setSimilarAds] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState(null);

  const numericAdId = useMemo(() => Number(adId), [adId]);
  const isOwner = ad && currentUserId !== null && ad.user_id === currentUserId;
  const images = useMemo(() => (ad?.image_url ? [ad.image_url] : []), [ad]);

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
        const [payload, similarPayload] = await Promise.all([
          fetchAdById(numericAdId),
          fetchSimilarAds(numericAdId, { limit: 12 }),
        ]);
        if (!mounted) {
          return;
        }
        setAd(payload);
        setSimilarAds(similarPayload?.items ?? []);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        if (requestError instanceof ApiError) {
          setError(requestError.status === 404 ? "Объявление не найдено" : requestError.message);
        } else {
          setError("Не удалось загрузить объявление");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    async function loadCurrentUser() {
      try {
        const me = await apiRequest("/auth/me");
        if (mounted) {
          setCurrentUserId(me?.id ?? null);
        }
      } catch {
        if (mounted) {
          setCurrentUserId(null);
        }
      }
    }

    loadAd();
    loadCurrentUser();
    return () => {
      mounted = false;
    };
  }, [numericAdId]);

  async function toggleFavorite() {
    if (currentUserId === null) {
      navigate("/login");
      return;
    }

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

  function handleShowPhone() {
    if (currentUserId === null) {
      navigate("/login");
      return;
    }
    setPhoneVisible(true);
  }

  async function handleReport() {
    if (currentUserId === null) {
      showToast("Войдите, чтобы отправить жалобу", { type: "info" });
      navigate("/login");
      return;
    }

    try {
      const response = await submitListingReport(ad.id);
      showToast(response?.message ?? "Жалоба отправлена модераторам", { type: "success" });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось отправить жалобу", {
        type: "error",
      });
    }
  }

  if (isLoading) {
    return (
      <section className="ad-page">
        <p className="ad-status">⏳ Загрузка...</p>
      </section>
    );
  }

  if (error || !ad) {
    return (
      <section className="ad-page">
        <article className="ad-card ad-card--empty">
          <p className="ad-status ad-status--error">{error ?? "Объявление не найдено"}</p>
          <BackButton fallback="/" label="На главную" />
        </article>
      </section>
    );
  }

  const breadcrumbs = isOwner
    ? [
        { label: "Каталог", to: "/" },
        { label: "Кабинет", to: "/profile" },
        { label: ad.title },
      ]
    : [
        { label: "Каталог", to: "/" },
        { label: ad.title },
      ];
  const chatLink = `/chat?listingId=${ad.id}`;

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <section className="ad-page">
        <BackButton fallback="/" />

        <div className="ad-layout">
          <div className="ad-layout__gallery">
            <AdGallery images={images} title={ad.title} />
          </div>

          <aside className="ad-layout__info">
            <span className="ad-category">{ad.category_name ?? "Категория"}</span>
            <h1 className="ad-title">{ad.title}</h1>
            <p className="ad-price">{formatPrice(ad.price)}</p>

            <div className="ad-actions">
              <Button type="button" variant="primary" className="ad-btn" onClick={handleShowPhone}>
                {phoneVisible && ad.author_phone ? ad.author_phone : "Показать телефон"}
              </Button>
              {currentUserId === null ? (
                <Button to="/login" variant="secondary" className="ad-btn">
                  Написать продавцу
                </Button>
              ) : (
                <Button to={chatLink} variant="secondary" className="ad-btn">
                  {isOwner ? "Чаты" : "Написать продавцу"}
                </Button>
              )}
              <button
                type="button"
                className={`sb-btn ad-btn ad-btn--fav ${ad.is_favorite ? "active" : ""}`}
                onClick={toggleFavorite}
                disabled={isFavoritePending}
                aria-label={ad.is_favorite ? "Убрать из избранного" : "В избранное"}
              >
                {ad.is_favorite ? "❤️" : "🤍"}
              </button>
            </div>

            <button type="button" className="ad-report" onClick={handleReport}>
              Пожаловаться
            </button>
          </aside>
        </div>

        <section className="ad-block">
          <h2>Описание</h2>
          <p className="ad-description">{ad.description || "Описание не указано."}</p>
        </section>

        <section className="ad-block ad-seller">
          <h2>Продавец</h2>
          <div className="ad-seller__card">
            <div className="ad-seller__avatar">
              {ad.author_avatar_url ? (
                <img src={ad.author_avatar_url} alt="" />
              ) : (
                <span>{(ad.author_name ?? "П")[0]}</span>
              )}
            </div>
            <div className="ad-seller__meta">
              <Link to={`/users/${ad.user_id}`} className="ad-seller__name">
                {ad.author_name ?? "Продавец"}
              </Link>
              <p>На SmartBoard с {formatDate(ad.author_created_at)}</p>
            </div>
          </div>
        </section>

        {similarAds.length > 0 ? (
          <section className="ad-block">
            <h2>Похожие объявления</h2>
            <div className="ad-similar">
              {similarAds.map((item) => (
                <Link key={item.id} to={`/ads/${item.id}`} className="ad-similar__card">
                  <div className="ad-similar__image">
                    {item.image_url ? <img src={item.image_url} alt="" /> : <span>📷</span>}
                  </div>
                  <p className="ad-similar__title">{item.title}</p>
                  <p className="ad-similar__price">{formatPrice(item.price)}</p>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </>
  );
}
