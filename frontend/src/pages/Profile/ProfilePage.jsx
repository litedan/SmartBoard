import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { BackButton } from "../../components/Layout/BackButton";
import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { Button } from "../../components/UI/Button";
import { useToast } from "../../components/UI/ToastProvider";
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
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isManagingListings, setIsManagingListings] = useState(false);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [myListings, setMyListings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
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

  function hasSpaces(value) {
    return /\s/.test(value);
  }

  function normalizePhone(value) {
    const digits = value.replace(/\D/g, "");
    if (digits.length !== 11 || !["7", "8"].includes(digits[0])) {
      return null;
    }
    return `+7${digits.slice(1)}`;
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

    const normalizedPhone = normalizePhone(profile.phone);
    const payload = {
      name: profile.name.trim(),
      last_name: profile.lastName.trim(),
      email: profile.email.trim(),
      phone: normalizedPhone ?? profile.phone.trim(),
    };

    if (!payload.name || !payload.last_name || !payload.email || !payload.phone) {
      showToast("Заполните имя, фамилию, телефон и email", { type: "info" });
      return;
    }
    if (hasSpaces(payload.name) || hasSpaces(payload.last_name)) {
      showToast("Имя и ник не должны содержать пробелы", { type: "info" });
      return;
    }
    if (!normalizedPhone) {
      showToast("Введите телефон в формате +7XXXXXXXXXX", { type: "info" });
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
      showToast("Профиль обновлён", { type: "success" });
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        showToast("Этот email уже используется другим аккаунтом", { type: "error" });
      } else {
        showToast(requestError instanceof ApiError ? requestError.message : "Не удалось сохранить профиль", { type: "error" });
      }
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!passwordForm.newPassword) {
      showToast("Введите новый пароль", { type: "info" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      showToast("Новый пароль должен быть не менее 6 символов", { type: "info" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showToast("Новый пароль и подтверждение не совпадают", { type: "info" });
      return;
    }

    setIsSavingPassword(true);
    try {
      await apiRequest("/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          new_password: passwordForm.newPassword,
        }),
      });
      setPasswordForm({ newPassword: "", confirmPassword: "" });
      showToast("Пароль успешно изменён", { type: "success" });
    } catch (requestError) {
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось изменить пароль", { type: "error" });
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
      showToast("Выберите изображение", { type: "info" });
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
      showToast("Фото профиля обновлено", { type: "success" });
    } catch (requestError) {
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить фото", { type: "error" });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleAvatarDelete() {
    if (!avatarUrl) {
      return;
    }
    setError(null);
    setSuccess(null);
    setIsUploadingAvatar(true);
    try {
      const response = await apiRequest("/profile/me/avatar", { method: "DELETE" });
      setAvatarUrl(getAvatarSrc(response?.avatar_url));
      showToast("Фото профиля удалено", { type: "success" });
    } catch (requestError) {
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось удалить фото", { type: "error" });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  async function handleListingToggle(listing) {
    setIsManagingListings(true);
    try {
      await updateAd(listing.id, { is_active: !listing.is_active });
      await refreshListingsAndFavorites();
      showToast("Статус объявления обновлён", { type: "success" });
    } catch (requestError) {
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось обновить статус", { type: "error" });
    } finally {
      setIsManagingListings(false);
    }
  }

  async function handleListingDelete(listingId) {
    if (!window.confirm("Удалить объявление?")) {
      return;
    }

    setIsManagingListings(true);
    try {
      await deleteAd(listingId);
      await refreshListingsAndFavorites();
      showToast("Объявление удалено", { type: "success" });
    } catch (requestError) {
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось удалить объявление", { type: "error" });
    } finally {
      setIsManagingListings(false);
    }
  }

  async function handleRemoveFavorite(listingId) {
    setIsManagingListings(true);
    try {
      await removeFavorite(listingId);
      await refreshListingsAndFavorites();
      showToast("Удалено из избранного", { type: "success" });
    } catch (requestError) {
      showToast(requestError instanceof ApiError ? requestError.message : "Не удалось удалить из избранного", { type: "error" });
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
      <BackButton fallback="/" />

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
          {avatarUrl ? (
            <button type="button" className="profile-upload-button" onClick={handleAvatarDelete} disabled={isUploadingAvatar}>
              Удалить фото
            </button>
          ) : null}
        </div>
      </div>

      <section className="profile-card">
        <h3>Мои объявления</h3>
        <div className="profile-listings">
          {myListings.map((listing) => (
            <article key={listing.id} className="profile-listings__item">
              <div className="profile-listings__main">
                <div className="profile-listings__thumb" aria-hidden="true">
                  {listing.image_url ? <img src={listing.image_url} alt="" /> : <span>📷</span>}
                </div>
                <div>
                <h4>
                  <Link to={`/ads/${listing.id}`}>{listing.title}</Link>
                </h4>
                <p>{formatPrice(listing.price)}</p>
                <small>{getListingStatusLabel(listing)}</small>
                </div>
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
              <div className="profile-listings__main">
                <div className="profile-listings__thumb" aria-hidden="true">
                  {listing.image_url ? <img src={listing.image_url} alt="" /> : <span>📷</span>}
                </div>
                <div>
                <h4>
                  <Link to={`/ads/${listing.id}`}>{listing.title}</Link>
                </h4>
                <p>{formatPrice(listing.price)}</p>
                <small>{listing.author_name ?? "Пользователь"}</small>
                </div>
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
                pattern="^\S+$"
              />
            </label>
            <label>
              Фамилия
              <input
                type="text"
                value={profile.lastName}
                onChange={(event) => updateProfileField("lastName", event.target.value)}
                required
                pattern="^\S+$"
              />
            </label>
            <label>
              Телефон
              <input
                type="tel"
                value={profile.phone}
                onChange={(event) => updateProfileField("phone", event.target.value)}
                required
                placeholder="+79991234567"
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
            <Button type="submit" variant="primary" loading={isSavingProfile} disabled={isSavingProfile}>
              Сохранить изменения
            </Button>
          </form>
        </article>

        <article className="profile-card">
          <h3>Смена пароля</h3>
          <form className="profile-form" onSubmit={handlePasswordSubmit}>
            <label>
              Новый пароль
              <span className="profile-password">
                <input
                  type={isNewPasswordVisible ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(event) => updatePasswordField("newPassword", event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="profile-password__toggle"
                  aria-label={isNewPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setIsNewPasswordVisible((prev) => !prev)}
                >
                  {isNewPasswordVisible ? "🙈" : "👁"}
                </button>
              </span>
            </label>
            <label>
              Подтвердите новый пароль
              <span className="profile-password">
                <input
                  type={isConfirmPasswordVisible ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(event) => updatePasswordField("confirmPassword", event.target.value)}
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  className="profile-password__toggle"
                  aria-label={isConfirmPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                  onClick={() => setIsConfirmPasswordVisible((prev) => !prev)}
                >
                  {isConfirmPasswordVisible ? "🙈" : "👁"}
                </button>
              </span>
            </label>
            <Button type="submit" variant="primary" loading={isSavingPassword} disabled={isSavingPassword}>
              Обновить пароль
            </Button>
          </form>
        </article>
      </div>

      <button type="button" className="profile-logout" onClick={handleLogout}>
        Выйти из аккаунта
      </button>
    </section>
  );
}
