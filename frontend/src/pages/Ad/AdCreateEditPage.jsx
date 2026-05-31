import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { BackButton } from "../../components/Layout/BackButton";
import { Button } from "../../components/UI/Button";
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

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
  const [fieldErrors, setFieldErrors] = useState({});

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

  function validate(nextForm, { includeQuantities } = {}) {
    const nextErrors = {};
    const title = nextForm.title.trim();
    const description = nextForm.description.trim();

    if (title.length < 3) nextErrors.title = "Минимум 3 символа";
    if (description.length < 5) nextErrors.description = "Минимум 5 символов";

    if (nextForm.price !== "" && nextForm.price !== null && nextForm.price !== undefined) {
      const price = Number(nextForm.price);
      if (Number.isNaN(price)) nextErrors.price = "Некорректная цена";
      else if (price < 0) nextErrors.price = "Цена не может быть отрицательной";
    }

    if (includeQuantities) {
      const quantityTotal = Number(nextForm.quantityTotal);
      const quantityAvailable = Number(nextForm.quantityAvailable);
      if (!Number.isInteger(quantityTotal) || quantityTotal < 1) nextErrors.quantityTotal = "Целое число ≥ 1";
      if (!Number.isInteger(quantityAvailable) || quantityAvailable < 0) nextErrors.quantityAvailable = "Целое число ≥ 0";
      if (Number.isInteger(quantityTotal) && Number.isInteger(quantityAvailable) && quantityAvailable > quantityTotal) {
        nextErrors.quantityAvailable = "Остаток не может быть больше общего количества";
      }
    }

    return nextErrors;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextFieldErrors = validate(form, { includeQuantities: isEditMode });
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError("Проверьте поля формы");
      return;
    }

    const title = form.title.trim();
    const description = form.description.trim();
    const quantityTotal = Number(form.quantityTotal);
    const quantityAvailable = Number(form.quantityAvailable);

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

  const breadcrumbs = isEditMode
    ? [
        { label: "Каталог", to: "/" },
        { label: "Кабинет", to: "/profile" },
        { label: form.title?.trim() || `Объявление #${adId}`, to: `/ads/${adId}` },
        { label: "Редактирование" },
      ]
    : [
        { label: "Каталог", to: "/" },
        { label: "Кабинет", to: "/profile" },
        { label: "Новое объявление" },
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
      <section className="ad-page ad-page--form">
        <article className="ad-card ad-card--form">
          <BackButton fallback="/profile" label="В кабинет" />

          <div className="ad-card__top">
          <span>{isEditMode ? "Редактирование" : "Новое объявление"}</span>
        </div>
          <h1 className="ad-form__title">{isEditMode ? "Редактировать объявление" : "Создать объявление"}</h1>
          <p className="ad-form__hint">
            {isEditMode
              ? "Измените нужные поля и сохраните."
              : "Заполните форму — объявление уйдёт на модерацию и появится в каталоге после одобрения."}
          </p>

          {isEditMode ? (
            <div className={`ad-status-chip ${isActive ? "ad-status-chip--active" : "ad-status-chip--inactive"}`}>
              Статус: {statusLabel}
            </div>
          ) : null}

          <form className="ad-form" onSubmit={handleSubmit}>
          <label>
            Заголовок
            <input
              type="text"
              value={form.title}
              onChange={(event) => {
                const next = { ...form, title: event.target.value };
                updateField("title", event.target.value);
                setFieldErrors(validate(next, { includeQuantities: isEditMode }));
              }}
              minLength={3}
              maxLength={200}
              required
            />
            {fieldErrors.title ? <span className="ad-inline-error">{fieldErrors.title}</span> : null}
          </label>

          <label>
            Описание
            <textarea
              value={form.description}
              onChange={(event) => {
                const next = { ...form, description: event.target.value };
                updateField("description", event.target.value);
                setFieldErrors(validate(next, { includeQuantities: isEditMode }));
              }}
              minLength={5}
              maxLength={5000}
              rows={6}
              required
            />
            {fieldErrors.description ? <span className="ad-inline-error">{fieldErrors.description}</span> : null}
          </label>

          <div className="ad-form__row">
            <label>
              Цена (₽)
              <input
                type="number"
                value={form.price}
                onChange={(event) => {
                  const next = { ...form, price: event.target.value };
                  updateField("price", event.target.value);
                  setFieldErrors(validate(next, { includeQuantities: isEditMode }));
                }}
                min={0}
                step="0.01"
                placeholder="Например, 5000"
              />
              {fieldErrors.price ? <span className="ad-inline-error">{fieldErrors.price}</span> : null}
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

          {isEditMode ? (
            <div className="ad-form__row">
              <label>
                Всего единиц
                <input
                  type="number"
                  value={form.quantityTotal}
                  onChange={(event) => {
                    const next = { ...form, quantityTotal: event.target.value };
                    updateField("quantityTotal", event.target.value);
                    setFieldErrors(validate(next, { includeQuantities: true }));
                  }}
                  min={1}
                  step={1}
                  required
                />
                {fieldErrors.quantityTotal ? <span className="ad-inline-error">{fieldErrors.quantityTotal}</span> : null}
              </label>
              <label>
                Остаток
                <input
                  type="number"
                  value={form.quantityAvailable}
                  onChange={(event) => {
                    const next = { ...form, quantityAvailable: event.target.value };
                    updateField("quantityAvailable", event.target.value);
                    setFieldErrors(validate(next, { includeQuantities: true }));
                  }}
                  min={0}
                  step={1}
                  required
                />
                {fieldErrors.quantityAvailable ? (
                  <span className="ad-inline-error">{fieldErrors.quantityAvailable}</span>
                ) : null}
              </label>
            </div>
          ) : null}

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
                if (nextFile && !ALLOWED_IMAGE_TYPES.has(nextFile.type)) {
                  setImageFile(null);
                  setError("Неподдерживаемый формат файла. Разрешены только JPG, PNG и WEBP.");
                  event.target.value = "";
                  return;
                }
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
            <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
              {isEditMode ? "Сохранить" : "Отправить на модерацию"}
            </Button>
            <Button to="/" variant="secondary">
              Выйти без сохранения
            </Button>
          </div>
        </form>
        </article>
      </section>
    </>
  );
}
