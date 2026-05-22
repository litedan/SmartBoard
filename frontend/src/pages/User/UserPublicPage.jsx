import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { fetchUserListings } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";
import { fetchPublicProfile } from "../../shared/api/profile";
import "./user.css";

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

export function UserPublicPage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setIsLoading(true);
      setError("");
      try {
        const [profilePayload, listingsPayload] = await Promise.all([
          fetchPublicProfile(userId),
          fetchUserListings(userId, { limit: 30, offset: 0 }),
        ]);
        if (!mounted) {
          return;
        }
        setProfile(profilePayload);
        setListings(listingsPayload?.items ?? []);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить профиль");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [userId]);

  if (isLoading) {
    return (
      <section className="user-page">
        <p className="user-status">Загружаем профиль продавца...</p>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="user-page">
        <article className="user-card">
          <p className="user-status user-status--error">{error || "Пользователь не найден"}</p>
          <button type="button" className="user-back" onClick={() => navigate(-1)}>
            Назад
          </button>
        </article>
      </section>
    );
  }

  const fullName = `${profile.user.name} ${profile.user.last_name}`.trim();

  return (
    <section className="user-page">
      <article className="user-card">
        <button type="button" className="user-back" onClick={() => navigate(-1)}>
          Назад
        </button>
        <h1>{fullName || "Пользователь"}</h1>
        <p>Активных объявлений: {profile.active_listings_total}</p>
        <p>
          Телефон:{" "}
          {profile.user.phone ? (
            <a href={`tel:${profile.user.phone}`} className="user-link">
              {profile.user.phone}
            </a>
          ) : (
            "не указан"
          )}
        </p>
      </article>

      <section className="user-card">
        <h2>Объявления продавца</h2>
        <div className="user-listings">
          {listings.map((listing) => (
            <article key={listing.id} className="user-listings__item">
              <h3>
                <Link to={`/ads/${listing.id}`}>{listing.title}</Link>
              </h3>
              <p>{formatPrice(listing.price)}</p>
              <small>{listing.category_name ?? "Без категории"}</small>
            </article>
          ))}
          {listings.length === 0 ? <p className="user-status">У продавца пока нет активных объявлений.</p> : null}
        </div>
      </section>
    </section>
  );
}
