import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { ProtectedRoute } from "../features/auth/components/ProtectedRoute";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { RegisterPage } from "../features/auth/pages/RegisterPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";
import { DashboardPage } from "../features/dashboard/pages/DashboardPage";
import { FaceSwapPage } from "../features/face-swap/pages/FaceSwapPage";
import { KaraokePage } from "../features/karaoke/pages/KaraokePage";
import { FilesPage } from "../features/media/pages/FilesPage";
import { ResultsPage } from "../features/media/pages/ResultsPage";
import { MusicVideoPage } from "../features/music-video/pages/MusicVideoPage";
import { ProfilePage } from "../features/profile/pages/ProfilePage";
import { ProjectProviderLayout } from "../features/projects/context/ProjectContext";
import { ProjectOverviewPage } from "../features/projects/pages/ProjectOverviewPage";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="security" element={<Navigate to="/profile" replace />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route
            path="projects/new"
            element={<Navigate to="/projects" replace />}
          />
          <Route path="projects/:projectId" element={<ProjectProviderLayout />}>
            <Route index element={<ProjectOverviewPage />} />
            <Route path="karaoke" element={<KaraokePage />} />
            <Route path="face-swap" element={<FaceSwapPage />} />
            <Route path="music-video" element={<MusicVideoPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="results" element={<ResultsPage />} />
            <Route
              path="jobs"
              element={<Navigate to=".." relative="path" replace />}
            />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
