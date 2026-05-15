import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "../components/Layout/AppLayout";
import { AdCreateEditPage } from "../pages/Ad/AdCreateEditPage";
import { AdDetailsPage } from "../pages/Ad/AdDetailsPage";
import { ForgotPasswordPage } from "../pages/Auth/ForgotPasswordPage";
import { LoginPage } from "../pages/Auth/LoginPage";
import { RegisterPage } from "../pages/Auth/RegisterPage";
import { HomePage } from "../pages/Home/HomePage";
import { ProfilePage } from "../pages/Profile/ProfilePage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/ads/new" element={<AdCreateEditPage />} />
          <Route path="/ads/:adId/edit" element={<AdCreateEditPage />} />
          <Route path="/ads/:adId" element={<AdDetailsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
