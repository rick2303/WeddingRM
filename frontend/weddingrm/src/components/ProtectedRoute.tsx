// components/ProtectedRoute.tsx
import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

interface Props {
  children?: ReactNode;
}

const ProtectedRoute = ({ children }: Props) => {
  const { status, token } = useAuthStore();

  const isAuth = status === "authenticated" && !!token;

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  // Soportar ambas formas: con children o usando <Outlet />
  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
