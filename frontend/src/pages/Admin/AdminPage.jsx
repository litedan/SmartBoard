import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, apiRequest } from "../../shared/api/client";
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

  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [stats, setStats] = useState(null);
  const [usersData, setUsersData] = useState({ meta: null, items: [] });
  const [listingsData, setListingsData] = useState({ meta: null, items: [] });
  const [categoriesData, setCategoriesData] = useState({ meta: null, items: [] });

  const [userFilters, setUserFilters] = useState({ query: "", role: "all" });
  const [listingFilters, setListingFilters] = useState({
    isActive: "all",
    userId: "",
    categoryId: "",
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

  function handleAuthError(requestError, fallbackMessage) {
    if (requestError instanceof ApiError && requestError.status === 401) {
      navigate("/login", { replace: true });
      return true;
    }
    if (requestError instanceof ApiError && requestError.status === 403) {
      navigate("/", { replace: true });
      return true;
    }

    setError(requestError instanceof ApiError ? requestError.message : fallbackMessage);
    return false;
  }

  async function refreshAll() {
    setError("");
    setSuccess("");
    setIsRefreshing(true);
    try {
      await Promise.all([loadDashboard(), loadUsers(), loadListings(), loadCategories()]);
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

  async function handleRoleUpdate(userId, role) {
    setError("");
    setSuccess("");
    setPendingAction(`user-role-${userId}`);
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      setSuccess("Роль пользователя обновлена");
      await Promise.all([loadUsers(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось обновить роль");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDeleteUser(userId) {
    if (!window.confirm("Удалить пользователя? Это действие нельзя отменить.")) {
      return;
    }

    setError("");
    setSuccess("");
    setPendingAction(`user-delete-${userId}`);
    try {
      await apiRequest(`/admin/users/${userId}`, { method: "DELETE" });
      setSuccess("Пользователь удалён");
      await Promise.all([loadUsers(), loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось удалить пользователя");
    } finally {
      setPendingAction("");
    }
  }

  async function handleListingStatusUpdate(listingId, isActive) {
    setError("");
    setSuccess("");
    setPendingAction(`listing-status-${listingId}`);
    try {
      await apiRequest(`/admin/listings/${listingId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: isActive }),
      });
      setSuccess("Статус объявления обновлён");
      await Promise.all([loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось обновить статус объявления");
    } finally {
      setPendingAction("");
    }
  }

  async function handleDeleteListing(listingId) {
    if (!window.confirm("Удалить объявление?")) {
      return;
    }

    setError("");
    setSuccess("");
    setPendingAction(`listing-delete-${listingId}`);
    try {
      await apiRequest(`/admin/listings/${listingId}`, { method: "DELETE" });
      setSuccess("Объявление удалено");
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
      setError("Введите название категории");
      return;
    }
    if (!slug) {
      setError("Введите slug категории");
      return;
    }

    setError("");
    setSuccess("");
    setPendingAction("category-create");
    try {
      await apiRequest("/admin/categories", {
        method: "POST",
        body: JSON.stringify({ name, slug }),
      });
      setNewCategory({ name: "", slug: "" });
      setSuccess("Категория создана");
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
      setError("Название и slug обязательны");
      return;
    }

    setError("");
    setSuccess("");
    setPendingAction(`category-edit-${categoryId}`);
    try {
      await apiRequest(`/admin/categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, slug }),
      });
      setEditingCategoryId(null);
      setSuccess("Категория обновлена");
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

    setError("");
    setSuccess("");
    setPendingAction(`category-delete-${categoryId}`);
    try {
      await apiRequest(`/admin/categories/${categoryId}`, { method: "DELETE" });
      setSuccess("Категория удалена");
      await Promise.all([loadCategories(), loadListings(), loadDashboard()]);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось удалить категорию");
    } finally {
      setPendingAction("");
    }
  }

  async function applyUserFilters(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await loadUsers(userFilters);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось применить фильтры пользователей");
    }
  }

  async function applyListingFilters(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await loadListings(listingFilters);
    } catch (requestError) {
      handleAuthError(requestError, "Не удалось применить фильтры объявлений");
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
      <button type="button" className="admin-back" onClick={() => navigate(-1)}>
        Назад
      </button>
      <div className="admin-header">
        <div>
          <h1>Админ-панель</h1>
          <p>Управление пользователями, объявлениями и категориями.</p>
        </div>
        <button type="button" onClick={refreshAll} disabled={isRefreshing}>
          {isRefreshing ? "Обновляем..." : "Обновить данные"}
        </button>
      </div>

      {error ? <p className="admin-feedback admin-feedback--error">{error}</p> : null}
      {success ? <p className="admin-feedback admin-feedback--success">{success}</p> : null}

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
          <button type="submit">Применить</button>
        </form>
        <p className="admin-meta">Найдено: {usersData?.meta?.total ?? 0}</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
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
                  <td>{user.id}</td>
                  <td>{`${user.name} ${user.last_name}`}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{formatDate(user.created_at)}</td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      disabled={pendingAction === `user-role-${user.id}`}
                      onClick={() => handleRoleUpdate(user.id, user.role === "admin" ? "user" : "admin")}
                    >
                      {user.role === "admin" ? "Сделать user" : "Сделать admin"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={pendingAction === `user-delete-${user.id}`}
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      Удалить
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
          <button type="submit">Применить</button>
        </form>
        <p className="admin-meta">Найдено: {listingsData?.meta?.total ?? 0}</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Заголовок</th>
                <th>Цена</th>
                <th>Автор</th>
                <th>Категория</th>
                <th>Статус</th>
                <th>Создано</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {listingsData.items.map((listing) => (
                <tr key={listing.id}>
                  <td>{listing.id}</td>
                  <td>{listing.title}</td>
                  <td>{listing.price ?? "—"}</td>
                  <td>{listing.user_id}</td>
                  <td>{listing.category_id ?? "—"}</td>
                  <td>{listing.is_active ? "active" : "inactive"}</td>
                  <td>{formatDate(listing.created_at)}</td>
                  <td className="admin-actions">
                    <button
                      type="button"
                      disabled={pendingAction === `listing-status-${listing.id}`}
                      onClick={() => handleListingStatusUpdate(listing.id, !listing.is_active)}
                    >
                      {listing.is_active ? "Деактивировать" : "Активировать"}
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={pendingAction === `listing-delete-${listing.id}`}
                      onClick={() => handleDeleteListing(listing.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {listingsData.items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="admin-empty">
                    Объявления не найдены
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

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
          <button type="submit" disabled={pendingAction === "category-create"}>
            Создать
          </button>
        </form>
        <p className="admin-meta">Всего: {categoriesData?.meta?.total ?? 0}</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
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
                    <td>{category.id}</td>
                    <td>
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
                    <td>
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
                    <td className="admin-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            disabled={pendingAction === `category-edit-${category.id}`}
                            onClick={() => submitCategoryEdit(category.id)}
                          >
                            Сохранить
                          </button>
                          <button type="button" onClick={() => setEditingCategoryId(null)}>
                            Отмена
                          </button>
                        </>
                      ) : (
                        <button type="button" onClick={() => startCategoryEdit(category)}>
                          Редактировать
                        </button>
                      )}
                      <button
                        type="button"
                        className="danger"
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
    </section>
  );
}
