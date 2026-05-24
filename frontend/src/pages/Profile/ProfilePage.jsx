import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { deleteAd, fetchMyAds, fetchMyFavorites, removeFavorite, updateAd } from "../../shared/api/ads";
import { ApiError, apiRequest } from "../../shared/api/client";
import "./profile.css";

const EMPTY_PROFILE = {
  name: "",
  lastName: "",
  email: "",
  phone: "",
};

function getAvatarSrc(avatarUrl) {
  if (!avatarUrl) {
    return null;
  }
  return avatarUrl;
}

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

function getListingStatusLabel(listing) {
  if (listing.is_active) {
    return listing.quantity_total > 1 ? "В наличии" : "Активно";
  }
  if ((listing.quantity_total ?? 1) > 1) {
    return (listing.quantity_available ?? 0) === 0 ? "Распродано" : "Продажи остановлены";
  }
  return "Услуга оказана";
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isManagingListings, setIsManagingListings] = useState(false);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [myListings, setMyListings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const initials = useMemo(() => {
    const fullName = `${profile.name} ${profile.lastName}`.trim();
    if (!fullName) {
      return "SB";
    }
    return fullName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [profile.name, profile.lastName]);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);
      try {
        const [profileResponse, listingsResponse, favoritesResponse] = await Promise.all([
          apiRequest("/profile/me"),
          fetchMyAds({ limit: 100, offset: 0 }),
          fetchMyFavorites({ limit: 100, offset: 0 }),
        ]);
        if (!mounted) {
          return;
        }
        setProfile({
          name: profileResponse.name ?? "",
          lastName: profileResponse.last_name ?? "",
          email: profileResponse.email ?? "",
          phone: profileResponse.phone ?? "",
        });
        setAvatarUrl(getAvatarSrc(profileResponse.avatar_url));
        setMyListings(listingsResponse?.items ?? []);
        setFavorites(favoritesResponse?.items ?? []);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        setError("Не удалось загрузить профиль. Попробуйте позже.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  function updateProfileField(field, value) {
    setError(null);
    setSuccess(null);
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  function updatePasswordField(field, value) {
    setError(null);
    setSuccess(null);
    setPasswordForm((prev) => ({ ...prev, [field]: value }));
  }

  async function refreshListingsAndFavorites() {
    const [listingsResponse, favoritesResponse] = await Promise.all([
      fetchMyAds({ limit: 100, offset: 0 }),
      fetchMyFavorites({ limit: 100, offset: 0 }),
    ]);
    setMyListings(listingsResponse?.items ?? []);
    setFavorites(favoritesResponse?.items ?? []);
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = {
      name: profile.name.trim(),
      last_name: profile.lastName.trim(),
      email: profile.email.trim(),
      phone: profile.phone.trim(),
    };

    if (!payload.name || !payload.last_name || !payload.email || !payload.phone) {
      setError("Заполните имя, фамилию, телефон и email");
      return;
    }

    setIsSavingProfile(true);
    try {
      const response = await apiRequest("/profile/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setProfile({
        name: response.name ?? "",
        lastName: response.last_name ?? "",
        email: response.email ?? "",
        phone: response.phone ?? "",
      });
      setSuccess("Профиль обновлён");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось сохранить профиль");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!passwordForm.currentPassword || !passwordForm.newPassword) {
      setError("Введите текущий и новый пароль");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setError("Новый пароль должен быть не менее 6 символов");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError("Новый пароль и подтверждение не совпадают");
      return;
    }

    setIsSavingPassword(true);
    try {
      await apiRequest("/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          current_password: passwordForm.currentPassword,
          new_password: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Пароль успешно изменён");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось изменить пароль");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleAvatarChange(event) {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) {
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setError("Выберите изображение");
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await apiRequest("/profile/me/avatar", {
        method: "POST",
        body: formData,
      });
      setAvatarUrl(getAvatarSrc(response.avatar_url));
      setSuccess("Фото профиля обновлено");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить фото");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleListingToggle(listing) {
    setIsManagingListings(true);
    setError(null);
    setSuccess(null);
    try {
      await updateAd(listing.id, { is_active: !listing.is_active });
      await refreshListingsAndFavorites();
      setSuccess("Статус объявления обновлён");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось обновить статус");
    } finally {
      setIsManagingListings(false);
    }
  }

  async function handleListingDelete(listingId) {
    if (!window.confirm("Удалить объявление?")) {
      return;
    }

    setIsManagingListings(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteAd(listingId);
      await refreshListingsAndFavorites();
      setSuccess("Объявление удалено");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось удалить объявление");
    } finally {
      setIsManagingListings(false);
    }
  }

  async function handleRemoveFavorite(listingId) {
    setIsManagingListings(true);
    setError(null);
    setSuccess(null);
    try {
      await removeFavorite(listingId);
      await refreshListingsAndFavorites();
      setSuccess("Удалено из избранного");
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : "Не удалось удалить из избранного");
    } finally {
      setIsManagingListings(false);
    }
  }

  async function handleLogout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      navigate("/login", { replace: true });
    }
  }

  if (isLoading) {
    return (
      <section className="profile-page">
        <p className="profile-status">Загружаем профиль...</p>
      </section>
    );
  }

  return (
    <section className="profile-page">
      <Breadcrumbs items={[{ label: "Каталог", to: "/" }, { label: "Кабинет" }]} />
      <button type="button" className="profile-back" onClick={() => navigate(-1)}>
        Назад
      </button>

      <div className="profile-card profile-head">
        <div className="profile-avatar-wrap">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Аватар пользователя" className="profile-avatar" />
          ) : (
            <div className="profile-avatar profile-avatar-fallback">{initials}</div>
          )}
        </div>
        <div className="profile-head-meta">
          <h2>Личный кабинет</h2>
          <p>Управляйте данными аккаунта, объявлениями и избранным.</p>
          <label className="profile-upload-button">
            {isUploadingAvatar ? "Загружаем..." : "Загрузить фото"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarChange}
              disabled={isUploadingAvatar}
            />
          </label>
        </div>
      </div>

      <section className="profile-card">
        <h3>Мои объявления</h3>
        <div className="profile-listings">
          {myListings.map((listing) => (
            <article key={listing.id} className="profile-listings__item">
              <div>
                <h4>
                  <Link to={`/ads/${listing.id}`}>{listing.title}</Link>
                </h4>
                <p>{formatPrice(listing.price)}</p>
                <small>{getListingStatusLabel(listing)}</small>
              </div>
              <div className="profile-listings__actions">
                <Link to={`/ads/${listing.id}/edit`}>Редактировать</Link>
                <button type="button" onClick={() => handleListingToggle(listing)} disabled={isManagingListings}>
                  {listing.is_active
                    ? (listing.quantity_total ?? 1) > 1
                      ? "Остановить продажи"
                      : "Отметить как оказано"
                    : "Вернуть в каталог"}
                </button>
                <button type="button" onClick={() => handleListingDelete(listing.id)} disabled={isManagingListings}>
                  Удалить
                </button>
              </div>
            </article>
          ))}
          {myListings.length === 0 ? <p className="profile-status">У вас пока нет объявлений.</p> : null}
        </div>
      </section>

      <section className="profile-card">
        <h3>Избранное</h3>
        <div className="profile-listings">
          {favorites.map((listing) => (
            <article key={listing.id} className="profile-listings__item">
              <div>
                <h4>
                  <Link to={`/ads/${listing.id}`}>{listing.title}</Link>
                </h4>
                <p>{formatPrice(listing.price)}</p>
                <small>{listing.author_name ?? "Пользователь"}</small>
              </div>
              <div className="profile-listings__actions">
                <button type="button" onClick={() => handleRemoveFavorite(listing.id)} disabled={isManagingListings}>
                  Убрать из избранного
                </button>
              </div>
            </article>
          ))}
          {favorites.length === 0 ? <p className="profile-status">Вы ещё не добавляли объявления в избранное.</p> : null}
        </div>
      </section>

      <div className="profile-grid">
        <article className="profile-card">
          <h3>Данные аккаунта</h3>
          <form className="profile-form" onSubmit={handleProfileSubmit}>
            <label>
              Имя
              <input
                type="text"
                value={profile.name}
                onChange={(event) => updateProfileField("name", event.target.value)}
                required
              />
            </label>
            <label>
              Фамилия
              <input
                type="text"
                value={profile.lastName}
                onChange={(event) => updateProfileField("lastName", event.target.value)}
                required
              />
            </label>
            <label>
              Телефон
              <input
                type="tel"
                value={profile.phone}
                onChange={(event) => updateProfileField("phone", event.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={profile.email}
                onChange={(event) => updateProfileField("email", event.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? "Сохраняем..." : "Сохранить изменения"}
            </button>
          </form>
        </article>

        <article className="profile-card">
          <h3>Смена пароля</h3>
          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <label>
              Текущий пароль
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) => updatePasswordField("currentPassword", event.target.value)}
                minLength={6}
                required
              />
            </label>
            <label>
              Новый пароль
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) => updatePasswordField("newPassword", event.target.value)}
                minLength={6}
                required
              />
            </label>
            <label>
              Подтвердите новый пароль
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => updatePasswordField("confirmPassword", event.target.value)}
                minLength={6}
                required
              />
            </label>
            <button type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? "Обновляем..." : "Обновить пароль"}
            </button>
          </form>
        </article>
      </div>

      {error ? <p className="profile-feedback profile-error">{error}</p> : null}
      {success ? <p className="profile-feedback profile-success">{success}</p> : null}

      <button type="button" className="profile-logout" onClick={handleLogout}>
        Выйти из аккаунта
      </button>
    </section>
  );
}
