import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/UI/Button";
import { ApiError, apiRequest } from "../../shared/api/client";
import "./auth.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState(null);

  function validate(nextEmail, nextPassword) {
    const normalizedEmail = nextEmail.trim();
    if (!normalizedEmail) {
      return "Введите email";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return "Введите корректный email";
    }
    if (/\s/.test(nextPassword)) {
      return "Пароль не должен содержать пробелы";
    }
    if (nextPassword.length < 6) {
      return "Пароль должен быть не менее 6 символов";
    }
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    const nextClientError = validate(email, password);
    setClientError(nextClientError);
    if (nextClientError) {
      return;
    }

    const normalizedEmail = email.trim();

    setIsSubmitting(true);

    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      window.dispatchEvent(new CustomEvent("smartboard:auth-changed"));
      navigate("/", { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("Что-то пошло не так. Попробуйте ещё раз.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Вход</h1>
        <p className="auth-subtitle">Войдите в SmartBoard, чтобы управлять объявлениями.</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-field">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => {
                const nextEmail = event.target.value;
                setEmail(nextEmail);
                setError(null);
                setClientError(validate(nextEmail, password));
              }}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="auth-field">
            Пароль
            <span className="auth-password">
              <input
                type={isPasswordVisible ? "text" : "password"}
                value={password}
                onChange={(event) => {
                  const nextPassword = event.target.value;
                  setPassword(nextPassword);
                  setError(null);
                  setClientError(validate(email, nextPassword));
                }}
                required
                minLength={6}
                autoComplete="current-password"
                placeholder="Минимум 6 символов"
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
          </label>
          {clientError ? <p className="auth-error">{clientError}</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting} className="auth-submit">
            Войти
          </Button>
          <Button type="button" variant="secondary" className="auth-submit" onClick={() => navigate("/", { replace: true })}>
            Продолжить как гость
          </Button>
        </form>
        <p className="auth-hint">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}
