import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Breadcrumbs } from "../../components/Layout/Breadcrumbs";
import { createAd, fetchAdById, fetchAdCategories, updateAd } from "../../shared/api/ads";
import { ApiError } from "../../shared/api/client";
import "./ad.css";

const INITIAL_FORM = {
  title: "",
  description: "",
  price: "",
  categoryId: "",
  quantityTotal: "1",
  quantityAvailable: "1",
};

export function AdCreateEditPage() {
  const navigate = useNavigate();
  const { adId } = useParams();
  const isEditMode = useMemo(() => Boolean(adId), [adId]);

  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [isLoadingPage, setIsLoadingPage] = useState(isEditMode);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [removeImage, setRemoveImage] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadCategories() {
      setIsLoadingCategories(true);
      try {
        const payload = await fetchAdCategories();
        if (!mounted) {
          return;
        }
        setCategories(Array.isArray(payload) ? payload : []);
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить категории");
      } finally {
        if (mounted) {
          setIsLoadingCategories(false);
        }
      }
    }

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadAd() {
      if (!isEditMode) {
        return;
      }
      setIsLoadingPage(true);
      setError(null);
      try {
        const payload = await fetchAdById(adId);
        if (!mounted) {
          return;
        }
        setForm({
          title: payload.title ?? "",
          description: payload.description ?? "",
          price: payload.price ?? "",
          categoryId: payload.category_id ? String(payload.category_id) : "",
          quantityTotal: String(payload.quantity_total ?? 1),
          quantityAvailable: String(payload.quantity_available ?? payload.quantity_total ?? 1),
        });
        setExistingImageUrl(payload.image_url ?? "");
        setIsActive(Boolean(payload.is_active));
      } catch (requestError) {
        if (!mounted) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        setError(requestError instanceof ApiError ? requestError.message : "Не удалось загрузить объявление");
      } finally {
        if (mounted) {
          setIsLoadingPage(false);
        }
      }
    }

    loadAd();
    return () => {
      mounted = false;
    };
  }, [adId, isEditMode, navigate]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreviewUrl("");
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function updateField(field, value) {
    setError(null);
    setSuccess(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const title = form.title.trim();
    const description = form.description.trim();

    if (title.length < 3) {
      setError("Заголовок должен быть не менее 3 символов");
      return;
    }
    if (description.length < 5) {
      setError("Описание должно быть не менее 5 символов");
      return;
    }
    if (form.price && Number(form.price) < 0) {
      setError("Цена не может быть отрицательной");
      return;
    }
    const quantityTotal = Number(form.quantityTotal);
    const quantityAvailable = Number(form.quantityAvailable);
    if (!Number.isInteger(quantityTotal) || quantityTotal < 1) {
      setError("Общее количество должно быть целым числом не меньше 1");
      return;
    }
    if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) {
      setError("Остаток должен быть целым числом не меньше 0");
      return;
    }
    if (quantityAvailable > quantityTotal) {
      setError("Остаток не может быть больше общего количества");
      return;
    }

    const payload = {
      title,
      description,
      price: form.price ? Number(form.price) : null,
      category_id: form.categoryId ? Number(form.categoryId) : null,
      quantity_total: quantityTotal,
      quantity_available: quantityAvailable,
      image: imageFile,
      remove_image: removeImage,
      is_active: isEditMode ? isActive : undefined,
    };

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = isEditMode ? await updateAd(adId, payload) : await createAd(payload);
      setSuccess(isEditMode ? "Объявление обновлено" : "Объявление успешно создано");
      navigate(`/ads/${saved.id}`, { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        if (requestError.status === 401) {
          navigate("/login", { replace: true });
          return;
        }
        if (requestError.status === 403) {
          setError("Вы не можете редактировать это объявление");
          return;
        }
        setError(requestError.message);
      } else {
        setError(isEditMode ? "Не удалось обновить объявление" : "Не удалось создать объявление");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoadingPage) {
    return (
      <section className="ad-page">
        <p className="ad-status">Загружаем форму объявления...</p>
      </section>
    );
  }

  const breadcrumbs = [
    { label: "Каталог", to: "/" },
    ...(isEditMode && adId ? [{ label: form.title?.trim() || `Объявление #${adId}`, to: `/ads/${adId}` }] : []),
    { label: isEditMode ? "Редактирование" : "Новое объявление" },
  ];

  const statusLabel = isActive
    ? Number(form.quantityTotal) > 1
      ? "В наличии"
      : "Активно"
    : Number(form.quantityTotal) > 1
      ? Number(form.quantityAvailable) === 0
        ? "Распродано"
        : "Продажи остановлены"
      : "Услуга оказана";

  return (
    <>
      <Breadcrumbs items={breadcrumbs} />
      <section className="ad-page">
        <article className="ad-card ad-card--form">
        <button type="button" className="ad-back-button" onClick={() => navigate(-1)}>
          <span aria-hidden="true">←</span>
          <span>Назад</span>
        </button>

        <div className="ad-card__top">
          <span>{isEditMode ? "Редактирование" : "Новое объявление"}</span>
          <span>SmartBoard</span>
        </div>
        <h1>{isEditMode ? "Редактировать объявление" : "Создать объявление"}</h1>
        <p className="ad-form__hint">{isEditMode ? "Измените нужные поля и сохраните." : "Заполните форму, и объявление появится в каталоге."}</p>

        <div className={`ad-status-chip ${isActive ? "ad-status-chip--active" : "ad-status-chip--inactive"}`}>
          Статус: {statusLabel}
        </div>

        <form className="ad-form" onSubmit={handleSubmit}>
          <label>
            Заголовок
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              minLength={3}
              maxLength={200}
              required
            />
          </label>

          <label>
            Описание
            <textarea
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              minLength={5}
              maxLength={5000}
              rows={6}
              required
            />
          </label>

          <div className="ad-form__row">
            <label>
              Цена (₽)
              <input
                type="number"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                min={0}
                step="0.01"
                placeholder="Например, 5000"
              />
            </label>
            <label>
              Категория
              <select
                value={form.categoryId}
                onChange={(event) => updateField("categoryId", event.target.value)}
                disabled={isLoadingCategories}
              >
                <option value="">Без категории</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="ad-form__row">
            <label>
              Всего единиц
              <input
                type="number"
                value={form.quantityTotal}
                onChange={(event) => updateField("quantityTotal", event.target.value)}
                min={1}
                step={1}
                required
              />
            </label>
            <label>
              Остаток
              <input
                type="number"
                value={form.quantityAvailable}
                onChange={(event) => updateField("quantityAvailable", event.target.value)}
                min={0}
                step={1}
                required
              />
            </label>
          </div>

          {isEditMode ? (
            <label className="ad-toggle">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              Показывать объявление в каталоге
            </label>
          ) : null}

          <label>
            Фото с диска (опционально)
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                const nextFile = event.target.files?.[0] ?? null;
                setError(null);
                setSuccess(null);
                setImageFile(nextFile);
                if (nextFile) {
                  setRemoveImage(false);
                }
              }}
            />
          </label>

          {existingImageUrl && !removeImage ? (
            <div className="ad-existing-image">
              <img src={existingImageUrl} alt="Текущее фото" />
              <button
                type="button"
                className="ad-button ad-button--ghost"
                onClick={() => {
                  setRemoveImage(true);
                  setImageFile(null);
                }}
              >
                Удалить текущее фото
              </button>
            </div>
          ) : null}

          {imageFile ? <p className="ad-status">Выбрано фото: {imageFile.name}</p> : null}
          {imagePreviewUrl ? (
            <div className="ad-existing-image">
              <img src={imagePreviewUrl} alt="Предпросмотр выбранного фото" />
            </div>
          ) : null}
          {removeImage ? <p className="ad-status">Текущее фото будет удалено после сохранения.</p> : null}

          {error ? <p className="ad-status ad-status--error">{error}</p> : null}
          {success ? <p className="ad-status ad-status--success">{success}</p> : null}

          <div className="ad-card__actions">
            <button type="submit" className="ad-button ad-button--primary" disabled={isSubmitting}>
              {isSubmitting ? "Сохраняем..." : isEditMode ? "Сохранить" : "Опубликовать"}
            </button>
            <Link to="/" className="ad-button ad-button--ghost">
              Выйти без сохранения
            </Link>
          </div>
        </form>
        </article>
      </section>
    </>
  );
}
