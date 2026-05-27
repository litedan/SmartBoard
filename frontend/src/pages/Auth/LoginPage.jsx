import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../components/UI/Button";
import { ApiError, apiRequest } from "../../shared/api/client";
import "./auth.css";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setClientError(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setClientError("Введите email");
      return;
    }
    if (password.length < 6) {
      setClientError("Пароль должен быть не менее 6 символов");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
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
                setEmail(event.target.value);
                setError(null);
                setClientError(null);
              }}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          <label className="auth-field">
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError(null);
                setClientError(null);
              }}
              required
              minLength={6}
              autoComplete="current-password"
              placeholder="Минимум 6 символов"
            />
          </label>
          {clientError ? <p className="auth-error">{clientError}</p> : null}
          {error ? <p className="auth-error">{error}</p> : null}
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting} className="auth-submit">
            Войти
          </Button>
        </form>
        <p className="auth-hint">
          Нет аккаунта? <Link to="/register">Зарегистрироваться</Link>
        </p>
      </section>
    </main>
  );
}
