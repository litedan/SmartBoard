import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "../components/Auth/RequireAuth";
import { AppLayout } from "../components/Layout/AppLayout";
import { AdCreateEditPage } from "../pages/Ad/AdCreateEditPage";
import { AdDetailsPage } from "../pages/Ad/AdDetailsPage";
import { AdminPage } from "../pages/Admin/AdminPage";
import { LoginPage } from "../pages/Auth/LoginPage";
import { RegisterPage } from "../pages/Auth/RegisterPage";
import { HomePage } from "../pages/Home/HomePage";
import { ProfilePage } from "../pages/Profile/ProfilePage";
import { ChatPage } from "../pages/Chat/ChatPage";
import { UserPublicPage } from "../pages/User/UserPublicPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/ads/new"
            element={
              <RequireAuth>
                <AdCreateEditPage />
              </RequireAuth>
            }
          />
          <Route
            path="/ads/:adId/edit"
            element={
              <RequireAuth>
                <AdCreateEditPage />
              </RequireAuth>
            }
          />
          <Route path="/ads/:adId" element={<AdDetailsPage />} />
          <Route path="/users/:userId" element={<UserPublicPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
