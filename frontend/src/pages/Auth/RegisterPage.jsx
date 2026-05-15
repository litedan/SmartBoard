import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { ApiError, apiRequest } from "../../shared/api/client";
import "./auth.css";

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
  const [clientError, setClientError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setError(null);
    setClientError(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setClientError(null);

    const payload = {
      email: formData.email.trim(),
      name: formData.name.trim(),
      last_name: formData.lastName.trim(),
      phone: formData.phone.trim(),
      password: formData.password,
    };

    if (!payload.name || !payload.last_name || !payload.email || !payload.phone) {
      setClientError("Заполните все поля");
      return;
    }
    if (formData.password.length < 6) {
      setClientError("Пароль должен быть не менее 6 символов");
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setClientError("Пароли не совпадают");
      return;
    }

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
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            Имя
            <input
              type="text"
              value={formData.name}
              onChange={(event) => updateField("name", event.target.value)}
              required
              autoComplete="given-name"
              placeholder="Иван"
            />
          </label>
          <label className="auth-field">
            Фамилия
            <input
              type="text"
              value={formData.lastName}
              onChange={(event) => updateField("lastName", event.target.value)}
              required
              autoComplete="family-name"
              placeholder="Иванов"
            />
          </label>
          <label className="auth-field">
            Телефон
            <input
              type="tel"
              value={formData.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              required
              autoComplete="tel"
              placeholder="+7 999 123-45-67"
            />
          </label>
          <label className="auth-field">
            Email
            <input
              type="email"
              value={formData.email}
              onChange={(event) => updateField("email", event.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="auth-field">
            Пароль
            <input
              type="password"
              value={formData.password}
              onChange={(event) => updateField("password", event.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Минимум 6 символов"
            />
          </label>
          <label className="auth-field">
            Повторите пароль
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Повторите пароль"
            />
          </label>
          {clientError ? <p className="auth-error">{clientError}</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Создаём..." : "Создать аккаунт"}
          </button>
        </form>
        <p className="auth-hint">
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </section>
    </main>
  );
}
