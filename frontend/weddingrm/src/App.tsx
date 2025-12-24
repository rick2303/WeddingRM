// App.tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import InviteView from "./pages/InviteView";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuthStore } from "./store/authStore";
import ElegantWeddingGallery from "./components/PhotoUploadGallery";

function App() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />

        {/* Invitación pública */}
        <Route path="/invite/:token" element={<InviteView />} />

        {/* Rutas protegidas */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="/gallery" element={<ElegantWeddingGallery />} />

        {/* fallback opcional */}
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
