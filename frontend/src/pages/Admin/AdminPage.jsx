import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { BackButton } from "../../components/Layout/BackButton";
import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { useToast } from "../../components/UI/ToastProvider";
import { ApiError, apiRequest } from "../../shared/api/client";
import { updateReportStatus } from "../../shared/api/reports";
import "./admin.css";

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("ru-RU");
}

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

function getModerationLabel(status) {
  if (status === "approved") return "Одобрено";
  if (status === "rejected") return "Отклонено";
  if (status === "pending") return "На модерации";
  return status ?? "—";
}

function getReportStatusLabel(status) {
  if (status === "blocked") return "Объявление заблокировано";
  if (status === "rejected") return "Оставлено без блокировки";
  if (status === "pending") return "Новая жалоба";
  return status ?? "—";
}

function buildPendingReportsFingerprint(items) {
  return items
    .filter((report) => (report.status ?? "pending") === "pending")
    .slice(0, 10)
    .map((r) => `${r.id ?? r.listing_id}:${r.user_id ?? "0"}:${r.created_at}`)
    .join("|");
}

function normalizeSlug(text) {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_а-яё]/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function AdminPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [currentAdminId, setCurrentAdminId] = useState(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingAction, setPendingAction] = useState("");

  const [stats, setStats] = useState(null);
  const [usersData, setUsersData] = useState({ meta: null, items: [] });
  const [listingsData, setListingsData] = useState({ meta: null, items: [] });
  const [categoriesData, setCategoriesData] = useState({ meta: null, items: [] });
  const [reportsData, setReportsData] = useState({ meta: null, items: [] });
  const [activeTab, setActiveTab] = useState("users");
  const [hasNewReports, setHasNewReports] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const lastReportsFingerprintRef = useRef("");

  const [userFilters, setUserFilters] = useState({ query: "", role: "all" });
  const [listingFilters, setListingFilters] = useState({
    isActive: "all",
    userId: "",
    categoryId: "",
    moderation: "all",
  });

  const [newCategory, setNewCategory] = useState({ name: "", slug: "" });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategory, setEditingCategory] = useState({ name: "", slug: "" });

  async function loadDashboard() {
    const payload = await apiRequest("/admin/dashboard");
    setStats(payload);
  }

  async function loadUsers(filters = userFilters) {
    const params = new URLSearchParams({
      limit: "20",
      offset: "0",
    });

    if (filters.query.trim()) {
      params.set("query", filters.query.trim());
    }
    if (filters.role !== "all") {
      params.set("role", filters.role);
    }

    const payload = await apiRequest(`/admin/users?${params.toString()}`);
    setUsersData(payload);
  }

  async function loadListings(filters = listingFilters) {
    const params = new URLSearchParams({
      limit: "20",
      offset: "0",
    });

    if (filters.isActive !== "all") {
      params.set("is_active", filters.isActive === "active" ? "true" : "false");
    }
    if (filters.moderation !== "all") {
      params.set("moderation_status", filters.moderation);
    }
    if (filters.userId.trim()) {
      params.set("user_id", filters.userId.trim());
    }
    if (filters.categoryId.trim()) {
      params.set("category_id", filters.categoryId.trim());
    }

    const payload = await apiRequest(`/admin/listings?${params.toString()}`);
    setListingsData(payload);
  }

  async function loadCategories() {
    const payload = await apiRequest("/admin/categories?limit=200&offset=0");
    setCategoriesData(payload);
  }

  function syncPendingReports(nextItems) {
    const pendingCount = nextItems.filter((report) => (report.status ?? "pending") === "pending").length;
    setPendingReportsCount(pendingCount);
    return pendingCount;
  }

  async function loadReports() {
    const payload = await apiRequest("/admin/reports?limit=100&offset=0");
    setReportsData(payload);
    const nextItems = payload?.items ?? [];
    syncPendingReports(nextItems);
    lastReportsFingerprintRef.current = buildPendingReportsFingerprint(nextItems);
  }

  function applyReportsPayload(payload, { markAsSeen = false } = {}) {
    const nextItems = payload?.items ?? [];
    syncPendingReports(nextItems);
    const nextFingerprint = buildPendingReportsFingerprint(nextItems);

    const previousFingerprint = lastReportsFingerprintRef.current;
    if (
      previousFingerprint &&
      nextFingerprint &&
      nextFingerprint !== previousFingerprint &&
      !markAsSeen
    ) {
      setHasNewReports(true);
      setActiveTab("reports");
      showToast("Поступила новая жалоба — выберите действие", { type: "info" });
    }

    lastReportsFingerprintRef.current = nextFingerprint;
    setReportsData(payload);
  }

  function handleAuthError(requestError, fallbackMessage) {
    if (requestError instanceof ApiError && requestError.status === 401) {
      navigate("/login", { replace: true });
      return true;
    }
    if (requestError instanceof ApiError && requestError.status === 403) {
      navigate("/", { replace: true });
      return true;
    }

    showToast(requestError instanceof ApiError ? requestError.message : fallbackMessage, { type: "error" });
    return false;
  }

  async function refreshAll() {
    setIsRefreshing(true);
    try {
      await Promise.all([loadDashboard(), loadUsers(), loadListings(), loadCategories(), loadReports()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось загрузить данные админки");
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setIsCheckingAccess(true);
      try {
        const me = await apiRequest("/auth/me");
        if (!mounted) {
          return;
        }

        if (me?.role !== "admin") {
          navigate("/", { replace: true });
          return;
        }
        setCurrentAdminId(me.id ?? null);

        await refreshAll();
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        handleAuthError(requestError, "Не удалось открыть админ-панель");
      } finally {
        if (mounted) {
          setIsCheckingAccess(false);
        }
      }
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (isCheckingAccess) {
      return undefined;
    }

    let mounted = true;

    async function pollReports() {
      try {
        const payload = await apiRequest("/admin/reports?limit=100&offset=0");
        if (!mounted) {
          return;
        }
        applyReportsPayload(payload, { markAsSeen: activeTab === "reports" });
      } catch {
        // тихо: фоновое обновление
      }
    }

    pollReports();
    const interval = window.setInterval(pollReports, 3000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [isCheckingAccess, activeTab]);

  function openReportsTab() {
    setActiveTab("reports");
    setHasNewReports(false);
  }

  async function handleRoleUpdate(userId, role) {
    if (currentAdminId === userId) {
      showToast("Нельзя менять роль самому себе", { type: "info" });
      return;
    }
    setPendingAction(`user-role-${userId}`);
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      showToast("Роль пользователя обновлена", { type: "success" });
      await Promise.all([loadUsers(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось обновить роль");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDeleteUser(userId) {
    if (currentAdminId === userId) {
      showToast("Нельзя удалить самого себя", { type: "info" });
      return;
    }
    if (!window.confirm("Удалить пользователя? Это действие нельзя отменить.")) {
      return;
    }

    setPendingAction(`user-delete-${userId}`);
    try {
      await apiRequest(`/admin/users/${userId}`, { method: "DELETE" });
      showToast("Пользователь удалён", { type: "success" });
      await Promise.all([loadUsers(), loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось удалить пользователя");
    } finally {
      setPendingAction("");
    }
  }

  async function handleListingStatusUpdate(listingId, isActive) {
    setPendingAction(`listing-status-${listingId}`);
    try {
      await apiRequest(`/admin/listings/${listingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      showToast("Статус объявления обновлён", { type: "success" });
      await Promise.all([loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось обновить статус объявления");
    } finally {
      setPendingAction("");
    }
  }

  async function handleListingModerationUpdate(listingId, moderationStatus) {
    setPendingAction(`listing-moderation-${listingId}`);
    try {
      await apiRequest(`/admin/listings/${listingId}/moderation`, {
        method: "PATCH",
        body: JSON.stringify({ moderation_status: moderationStatus }),
      });
      showToast("Статус модерации обновлён", { type: "success" });
      await Promise.all([loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось обновить модерацию");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDeleteListing(listingId) {
    if (!window.confirm("Удалить объявление?")) {
      return;
    }

    setPendingAction(`listing-delete-${listingId}`);
    try {
      await apiRequest(`/admin/listings/${listingId}`, { method: "DELETE" });
      showToast("Объявление удалено", { type: "success" });
      await Promise.all([loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось удалить объявление");
    } finally {
      setPendingAction("");
    }
  }

  async function handleCreateCategory(event) {
    event.preventDefault();
    const name = newCategory.name.trim();
    const slug = (newCategory.slug.trim() || normalizeSlug(name)).trim();

    if (!name) {
      showToast("Введите название категории", { type: "info" });
      return;
    }
    if (!slug) {
      showToast("Введите slug категории", { type: "info" });
      return;
    }

    setPendingAction("category-create");
    try {
      await apiRequest("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setNewCategory({ name: "", slug: "" });
      showToast("Категория создана", { type: "success" });
      await Promise.all([loadCategories(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось создать категорию");
    } finally {
      setPendingAction("");
    }
  }

  function startCategoryEdit(category) {
    setEditingCategoryId(category.id);
    setEditingCategory({
      name: category.name,
      slug: category.slug,
    });
  }

  async function submitCategoryEdit(categoryId) {
    const name = editingCategory.name.trim();
    const slug = editingCategory.slug.trim();

    if (!name || !slug) {
      showToast("Название и slug обязательны", { type: "info" });
      return;
    }

    setPendingAction(`category-edit-${categoryId}`);
    try {
      await apiRequest(`/admin/categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, slug }),
      });
      setEditingCategoryId(null);
      showToast("Категория обновлена", { type: "success" });
      await loadCategories();
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось обновить категорию");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDeleteCategory(categoryId) {
    if (!window.confirm("Удалить категорию?")) {
      return;
    }

    setPendingAction(`category-delete-${categoryId}`);
    try {
      await apiRequest(`/admin/categories/${categoryId}`, { method: "DELETE" });
      showToast("Категория удалена", { type: "success" });
      await Promise.all([loadCategories(), loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось удалить категорию");
    } finally {
      setPendingAction("");
    }
  }

  async function applyUserFilters(event) {
    event.preventDefault();
    try {
      await loadUsers(userFilters);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось применить фильтры пользователей");
    }
  }

  async function applyListingFilters(event) {
    event.preventDefault();
    try {
      await loadListings(listingFilters);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось применить фильтры объявлений");
    }
  }

  async function handleReportResolve(reportId, status) {
    setPendingAction(`report-${status}-${reportId}`);
    try {
      await updateReportStatus(reportId, status);
      showToast(
        status === "blocked"
          ? "Объявление заблокировано по жалобе"
          : "Жалоба закрыта, объявление оставлено без изменений",
        { type: "success" },
      );
      await Promise.all([loadReports(), loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось обновить жалобу");
    } finally {
      setPendingAction("");
    }
  }

  if (isCheckingAccess) {
    return (
      <section className="admin-page">
        <p className="admin-status">Проверяем доступ к админке...</p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <Breadcrumbs items={[{ label: "Каталог", to: "/" }, { label: "Админ-панель" }]} />
      <BackButton fallback="/" />
      <div className="admin-header">
        <div>
          <h1>Админ-панель</h1>
          <p>Управление пользователями, объявлениями и категориями.</p>
        </div>
        <button type="button" onClick={refreshAll} disabled={isRefreshing}>
          {isRefreshing ? "Обновляем..." : "Обновить данные"}
        </button>
      </div>
      <nav className="admin-tabs" aria-label="Разделы админки">
        <button
          type="button"
          className={activeTab === "users" ? "active" : ""}
          onClick={() => setActiveTab("users")}
        >
          Пользователи
        </button>
        <button
          type="button"
          className={activeTab === "listings" ? "active" : ""}
          onClick={() => setActiveTab("listings")}
        >
          Объявления
        </button>
        <button
          type="button"
          className={activeTab === "categories" ? "active" : ""}
          onClick={() => setActiveTab("categories")}
        >
          Категории
        </button>
        <button
          type="button"
          className={`admin-tabs__item${activeTab === "reports" ? " active" : ""}`}
          onClick={openReportsTab}
        >
          Жалобы
          {pendingReportsCount > 0 ? (
            <span className="admin-tabs__badge" aria-label={`Жалоб на рассмотрении: ${pendingReportsCount}`}>
              {pendingReportsCount > 99 ? "99+" : pendingReportsCount}
            </span>
          ) : hasNewReports ? (
            <span className="admin-tabs__dot" aria-label="Новые жалобы" />
          ) : null}
        </button>
      </nav>

      <section className="admin-card">
        <h2>Сводка</h2>
        <div className="admin-stats-grid">
          <article>
            <span>Пользователи</span>
            <strong>{stats?.users_total ?? 0}</strong>
          </article>
          <article>
            <span>Админы</span>
            <strong>{stats?.admins_total ?? 0}</strong>
          </article>
          <article>
            <span>Объявления</span>
            <strong>{stats?.listings_total ?? 0}</strong>
          </article>
          <article>
            <span>Активные объявления</span>
            <strong>{stats?.active_listings_total ?? 0}</strong>
          </article>
          <article>
            <span>Категории</span>
            <strong>{stats?.categories_total ?? 0}</strong>
          </article>
        </div>
      </section>

      {activeTab === "users" ? (
        <section className="admin-card">
        <h2>Пользователи</h2>
        <form className="admin-filters" onSubmit={applyUserFilters}>
          <input
            type="text"
            placeholder="Поиск по email/имени"
            value={userFilters.query}
            onChange={(event) => setUserFilters((prev) => ({ ...prev, query: event.target.value }))}
          />
          <select
            value={userFilters.role}
            onChange={(event) => setUserFilters((prev) => ({ ...prev, role: event.target.value }))}
          >
            <option value="all">Все роли</option>
            <option value="user">Только user</option>
            <option value="admin">Только admin</option>
          </select>
          <button type="submit" className="admin-btn admin-btn--primary">Применить</button>
        </form>
        <p className="admin-meta">Найдено: {usersData?.meta?.total ?? 0}</p>
        <div className="admin-table-wrap admin-table-wrap--stackable">
          <table className="admin-table admin-table--stackable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Создан</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {usersData.items.map((user) => (
                <tr key={user.id}>
                  <td data-label="ID">{user.id}</td>
                  <td data-label="Имя">{`${user.name} ${user.last_name}`}</td>
                  <td data-label="Email">{user.email}</td>
                  <td data-label="Роль">{user.role}</td>
                  <td data-label="Создан">{formatDate(user.created_at)}</td>
                  <td className="admin-actions" data-label="Действия">
                    <button
                      type="button"
                      className="admin-btn admin-btn--primary"
                      disabled={pendingAction === `user-role-${user.id}` || currentAdminId === user.id}
                      onClick={() => handleRoleUpdate(user.id, user.role === "admin" ? "user" : "admin")}
                    >
                      {user.role === "admin" ? "Сделать user" : "Сделать admin"}
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      disabled={pendingAction === `user-delete-${user.id}` || currentAdminId === user.id}
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      {currentAdminId === user.id ? "Это вы" : "Удалить"}
                    </button>
                  </td>
                </tr>
              ))}
              {usersData.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="admin-empty">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {activeTab === "listings" ? (
        <section className="admin-card">
        <h2>Объявления</h2>
        <form className="admin-filters" onSubmit={applyListingFilters}>
          <select
            value={listingFilters.isActive}
            onChange={(event) =>
              setListingFilters((prev) => ({ ...prev, isActive: event.target.value }))
            }
          >
            <option value="all">Все статусы</option>
            <option value="active">Только активные</option>
            <option value="inactive">Только неактивные</option>
          </select>
          <select
            value={listingFilters.moderation}
            onChange={(event) => setListingFilters((prev) => ({ ...prev, moderation: event.target.value }))}
          >
            <option value="all">Вся модерация</option>
            <option value="pending">На модерации</option>
            <option value="approved">Одобрено</option>
            <option value="rejected">Отклонено</option>
          </select>
          <input
            type="number"
            min="1"
            placeholder="ID автора"
            value={listingFilters.userId}
            onChange={(event) => setListingFilters((prev) => ({ ...prev, userId: event.target.value }))}
          />
          <input
            type="number"
            min="1"
            placeholder="ID категории"
            value={listingFilters.categoryId}
            onChange={(event) =>
              setListingFilters((prev) => ({ ...prev, categoryId: event.target.value }))
            }
          />
          <button type="submit" className="admin-btn admin-btn--primary">Применить</button>
        </form>
        <p className="admin-meta">Найдено: {listingsData?.meta?.total ?? 0}</p>
        <div className="admin-listings-list">
          {listingsData.items.map((listing) => {
            const isOwnListing = currentAdminId !== null && listing.user_id === currentAdminId;
            const moderationLabel = getModerationLabel(listing.moderation_status);

            return (
              <article key={listing.id} className="admin-listing-card">
                <Link to={`/ads/${listing.id}`} className="admin-listing-card__main">
                  <div className="admin-listing-card__thumb">
                    {listing.image_url ? <img src={listing.image_url} alt="" /> : <span>📷</span>}
                  </div>
                  <div className="admin-listing-card__meta">
                    <h3>{listing.title}</h3>
                    <p className="admin-listing-card__price">{formatPrice(listing.price)}</p>
                    <p className="admin-listing-card__details">
                      ID {listing.id} · Автор {listing.user_id} · {listing.is_active ? "Активно" : "Неактивно"} ·{" "}
                      {moderationLabel}
                    </p>
                    <p className="admin-listing-card__date">{formatDate(listing.created_at)}</p>
                  </div>
                </Link>
                <div className="admin-listing-card__actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    disabled={pendingAction === `listing-moderation-${listing.id}` || isOwnListing}
                    onClick={() => handleListingModerationUpdate(listing.id, "approved")}
                  >
                    Одобрить
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    disabled={pendingAction === `listing-moderation-${listing.id}` || isOwnListing}
                    onClick={() => handleListingModerationUpdate(listing.id, "rejected")}
                  >
                    Отклонить
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={pendingAction === `listing-status-${listing.id}`}
                    onClick={() => handleListingStatusUpdate(listing.id, !listing.is_active)}
                  >
                    {listing.is_active ? "Деактивировать" : "Активировать"}
                  </button>
                  <button
                    type="button"
                    className="admin-btn admin-btn--danger"
                    disabled={pendingAction === `listing-delete-${listing.id}`}
                    onClick={() => handleDeleteListing(listing.id)}
                  >
                    Удалить
                  </button>
                </div>
              </article>
            );
          })}
          {listingsData.items.length === 0 ? <p className="admin-empty">Объявления не найдены</p> : null}
        </div>
      </section>
      ) : null}

      {activeTab === "categories" ? (
        <section className="admin-card">
        <h2>Категории</h2>
        <form className="admin-filters" onSubmit={handleCreateCategory}>
          <input
            type="text"
            placeholder="Название категории"
            value={newCategory.name}
            onChange={(event) =>
              setNewCategory((prev) => ({
                ...prev,
                name: event.target.value,
                slug: prev.slug || normalizeSlug(event.target.value),
              }))
            }
          />
          <input
            type="text"
            placeholder="slug"
            value={newCategory.slug}
            onChange={(event) => setNewCategory((prev) => ({ ...prev, slug: event.target.value }))}
          />
          <button type="submit" className="admin-btn admin-btn--primary" disabled={pendingAction === "category-create"}>
            Создать
          </button>
        </form>
        <p className="admin-meta">Всего: {categoriesData?.meta?.total ?? 0}</p>
        <div className="admin-table-wrap admin-table-wrap--stackable">
          <table className="admin-table admin-table--stackable">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Slug</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {categoriesData.items.map((category) => {
                const isEditing = editingCategoryId === category.id;
                return (
                  <tr key={category.id}>
                    <td data-label="ID">{category.id}</td>
                    <td data-label="Название">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingCategory.name}
                          onChange={(event) =>
                            setEditingCategory((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
                      ) : (
                        category.name
                      )}
                    </td>
                    <td data-label="Slug">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingCategory.slug}
                          onChange={(event) =>
                            setEditingCategory((prev) => ({ ...prev, slug: event.target.value }))
                          }
                        />
                      ) : (
                        category.slug
                      )}
                    </td>
                    <td className="admin-actions" data-label="Действия">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="admin-btn admin-btn--primary"
                            disabled={pendingAction === `category-edit-${category.id}`}
                            onClick={() => submitCategoryEdit(category.id)}
                          >
                            Сохранить
                          </button>
                          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => setEditingCategoryId(null)}>
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button type="button" className="admin-btn admin-btn--secondary" onClick={() => startCategoryEdit(category)}>
                          Редактировать
                        </button>
                      )}
                      <button
                        type="button"
                        className="admin-btn admin-btn--danger"
                        disabled={pendingAction === `category-delete-${category.id}`}
                        onClick={() => handleDeleteCategory(category.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                );
              })}
              {categoriesData.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="admin-empty">
                    Категории не найдены
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      ) : null}

      {activeTab === "reports" ? (
        <section className="admin-card">
          <h2>Жалобы</h2>
          <p className="admin-meta">
            Всего: {reportsData?.meta?.total ?? 0}. Для новой жалобы выберите «Оставить» или «Заблокировать».
          </p>
          <div className="admin-listings-list">
            {reportsData.items.map((report, index) => {
              const reportStatus = report.status ?? "pending";
              const isPending = reportStatus === "pending";

              return (
              <article
                key={report.id ?? `${report.listing_id}-${report.user_id}-${report.created_at}-${index}`}
                className={`admin-listing-card${isPending ? " admin-listing-card--report-new" : ""}`}
              >
                <Link to={`/ads/${report.listing_id}`} className="admin-listing-card__main">
                  <div className="admin-listing-card__thumb">
                    {report.listing_image_url ? (
                      <img src={report.listing_image_url} alt="" />
                    ) : (
                      <span>📷</span>
                    )}
                  </div>
                  <div className="admin-listing-card__meta">
                    <h3>{report.listing_title ?? `Объявление #${report.listing_id}`}</h3>
                    <span className={`admin-report-status admin-report-status--${reportStatus}`}>
                      {getReportStatusLabel(reportStatus)}
                    </span>
                    <p className="admin-listing-card__details">
                      Объявление #{report.listing_id} · Жалобу отправил пользователь #{report.user_id ?? "—"}
                    </p>
                    <p className="admin-listing-card__details">Причина: {report.reason || "Не указана"}</p>
                    <p className="admin-listing-card__date">{formatDate(report.created_at)}</p>
                  </div>
                </Link>
                {isPending ? (
                  <div className="admin-listing-card__actions admin-listing-card__actions--report">
                    <button
                      type="button"
                      className="admin-btn admin-btn--secondary"
                      disabled={pendingAction === `report-rejected-${report.id}`}
                      onClick={() => handleReportResolve(report.id, "rejected")}
                    >
                      Оставить
                    </button>
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      disabled={pendingAction === `report-blocked-${report.id}`}
                      onClick={() => handleReportResolve(report.id, "blocked")}
                    >
                      Заблокировать
                    </button>
                  </div>
                ) : null}
              </article>
              );
            })}
            {reportsData.items.length === 0 ? <p className="admin-empty">Жалобы отсутствуют</p> : null}
          </div>
        </section>
      ) : null}
    </section>
  );
}
