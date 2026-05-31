import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/UI/Button";
import { checkEmailAvailable } from "../../shared/api/auth";
import { ApiError, apiRequest } from "../../shared/api/client";
import "./auth.css";

const NICK_PATTERN = /^[A-Za-zА-Яа-яЁё0-9_-]+$/;

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildFieldErrors(formData, { emailStatus = "idle" } = {}) {
  const errors = {};

  const name = formData.name.trim();
  const lastName = formData.lastName.trim();
  const email = formData.email.trim();
  const phone = formData.phone.trim();

  if (name && hasSpaces(name)) {
    errors.name = "Имя не должно содержать пробелы";
  } else if (name && !NICK_PATTERN.test(name)) {
    errors.name = "Имя содержит недопустимые символы";
  }

  if (lastName && hasSpaces(lastName) || str.startsWith(' ') || str.endsWith(' ')) {
    errors.lastName = "Ник не должен содержать пробелы";
  } else if (lastName && !NICK_PATTERN.test(lastName)) {
    errors.lastName = "Ник содержит недопустимые символы";
  }

  if (email && !isValidEmail(email)) {
    errors.email = "Введите корректный email";
  } else if (email && isValidEmail(email) && emailStatus === "taken") {
    errors.email = "Этот email уже зарегистрирован";
  }

  if (phone.trim()) {
    if (!normalizePhone(phone)) {
      errors.phone = "Введите телефон в формате +7XXXXXXXXXX";
    }
  }

  if (formData.password) {
    if (hasSpaces(formData.password)) {
      errors.password = "Пароль не должен содержать пробелы";
    } else if (formData.password.length < 6) {
      errors.password = "Пароль должен быть не менее 6 символов";
    }
  }

  if (formData.confirmPassword && formData.password !== formData.confirmPassword) {
    errors.confirmPassword = "Пароли не совпадают";
  }

  return errors;
}

function getSubmitError(formData, fieldErrors, emailStatus) {
  if (!formData.name.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim()) {
    return "Заполните все поля";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return Object.values(fieldErrors)[0];
  }
  if (emailStatus !== "available") {
    return "Дождитесь проверки email";
  }
  return null;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [emailStatus, setEmailStatus] = useState("idle");

  const fieldErrors = useMemo(
    () => buildFieldErrors(formData, { emailStatus }),
    [formData, emailStatus],
  );

  const canSubmit = useMemo(() => {
    if (isSubmitting || emailStatus === "checking") {
      return false;
    }
    return !getSubmitError(formData, fieldErrors, emailStatus);
  }, [formData, fieldErrors, emailStatus, isSubmitting]);

  useEffect(() => {
    const email = formData.email.trim();
    if (!isValidEmail(email)) {
      setEmailStatus("idle");
      return undefined;
    }

    let cancelled = false;
    setEmailStatus("checking");

    const timeoutId = window.setTimeout(async () => {
      try {
        const payload = await checkEmailAvailable(email);
        if (cancelled) {
          return;
        }
        setEmailStatus(payload?.available ? "available" : "taken");
      } catch {
        if (!cancelled) {
          setEmailStatus("idle");
        }
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [formData.email]);

  function updateField(field, value) {
    setError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    const submitError = getSubmitError(formData, fieldErrors, emailStatus);
    if (submitError) {
      setError(submitError);
      return;
    }

    const normalizedPhone = normalizePhone(formData.phone);
    const payload = {
      email: formData.email.trim(),
      name: formData.name.trim(),
      last_name: formData.lastName.trim(),
      phone: normalizedPhone ?? formData.phone.trim(),
      password: formData.password,
    };

    setIsSubmitting(true);
    try {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      navigate("/login", { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
        if (requestError.status === 409) {
          setEmailStatus("taken");
        }
      } else {
        setError("Не удалось создать аккаунт. Попробуйте позже.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Регистрация</h1>
        <p className="auth-subtitle">Создайте аккаунт, чтобы публиковать объявления.</p>
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <label className={`auth-field${fieldErrors.name ? " auth-field--invalid" : ""}`}>
            Имя
            <input
              type="text"
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
              autoComplete="given-name"
              placeholder="Иван"
            />
            {fieldErrors.name ? <span className="auth-field-error">{fieldErrors.name}</span> : null}
          </label>
          <label className={`auth-field${fieldErrors.lastName ? " auth-field--invalid" : ""}`}>
            Ник
            <input
              type="text"
              value={formData.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              required
              autoComplete="nickname"
              placeholder="ivanov"
            />
            {fieldErrors.lastName ? <span className="auth-field-error">{fieldErrors.lastName}</span> : null}
          </label>
          <label className={`auth-field${fieldErrors.phone ? " auth-field--invalid" : ""}`}>
            Телефон
            <input
              type="tel"
              value={formData.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              required
              autoComplete="tel"
              placeholder="+79991234567"
            />
            {fieldErrors.phone ? <span className="auth-field-error">{fieldErrors.phone}</span> : null}
          </label>
          <label
            className={`auth-field${fieldErrors.email ? " auth-field--invalid" : ""}${
              emailStatus === "available" ? " auth-field--valid" : ""
            }`}
          >
            Email
            <input
              type="email"
              value={formData.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
            {fieldErrors.email ? <span className="auth-field-error">{fieldErrors.email}</span> : null}
            {emailStatus === "checking" && isValidEmail(formData.email) ? (
              <span className="auth-field-hint">Проверяем email...</span>
            ) : null}
            {emailStatus === "available" && !fieldErrors.email ? (
              <span className="auth-field-ok">Email свободен</span>
            ) : null}
          </label>
          <label className={`auth-field${fieldErrors.password ? " auth-field--invalid" : ""}`}>
            Пароль
            <span className="auth-password">
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={formData.password}
                onChange={(event) => updateField("password", event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Минимум 6 символов, без пробелов"
              />
              <button
                type="button"
                className="auth-password__toggle"
                aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setIsPasswordVisible((prev) => !prev)}
              >
                {isPasswordVisible ? "🙈" : "👁"}
              </button>
            </span>
            {fieldErrors.password ? <span className="auth-field-error">{fieldErrors.password}</span> : null}
          </label>
          <label className={`auth-field${fieldErrors.confirmPassword ? " auth-field--invalid" : ""}`}>
            Повторите пароль
            <span className="auth-password">
              <input
                type={isConfirmPasswordVisible ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="Повторите пароль"
              />
              <button
                type="button"
                className="auth-password__toggle"
                aria-label={isConfirmPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setIsConfirmPasswordVisible((prev) => !prev)}
              >
                {isConfirmPasswordVisible ? "🙈" : "👁"}
              </button>
            </span>
            {fieldErrors.confirmPassword ? (
              <span className="auth-field-error">{fieldErrors.confirmPassword}</span>
            ) : null}
          </label>
          {error ? <p className="auth-error">{error}</p> : null}
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={!canSubmit}
            className="auth-submit"
          >
            Создать аккаунт
          </Button>
        </form>
        <p className="auth-hint">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </section>
    </main>
  );
}
