import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { apiRequest } from "../../shared/api/client";

export function RequireAuth({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        await apiRequest("/auth/me");
        if (mounted) {
          setStatus("ok");
        }
      } catch {
        if (mounted) {
          setStatus("denied");
        }
      }
    }

    checkAuth();
    return () => {
      mounted = false;
    };
  }, []);

  if (status === "loading") {
    return (
      <section className="ad-page">
        <p className="ad-status">⏳ Проверяем вход...</p>
      </section>
    );
  }

  if (status === "denied") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
