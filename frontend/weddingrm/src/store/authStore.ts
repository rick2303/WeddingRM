// store/authStore.ts
import { create } from "zustand";
import { loginRequest, type LoginResponse } from "../api/auth";

type AuthStatus = "idle" | "loading" | "authenticated" | "error";

interface AuthState {
  status: AuthStatus;
  token: string | null;
  email: string | null;
  role: string | null;
  errorMessage: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restoreSession: () => void;
}

const TOKEN_KEY = "invite_token";
const EMAIL_KEY = "invite_email";
const ROLE_KEY = "invite_role";

export const useAuthStore = create<AuthState>((set) => ({
  status: "idle",
  token: null,
  email: null,
  role: null,
  errorMessage: null,

  async login(email, password) {
    try {
      set({ status: "loading", errorMessage: null });
      const res: LoginResponse = await loginRequest({ email, password });

      // guardar en localStorage
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(EMAIL_KEY, res.email);
      localStorage.setItem(ROLE_KEY, res.role);

      set({
        status: "authenticated",
        token: res.token,
        email: res.email,
        role: res.role,
        errorMessage: null,
      });
    } catch (err: any) {
      console.error(err);
      set({
        status: "error",
        errorMessage: err?.message ?? "Error al iniciar sesión",
        token: null,
        email: null,
        role: null,
      });
    }
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(ROLE_KEY);

    set({
      status: "idle",
      token: null,
      email: null,
      role: null,
      errorMessage: null,
    });
  },

  restoreSession() {
    const token = localStorage.getItem(TOKEN_KEY);
    const email = localStorage.getItem(EMAIL_KEY);
    const role = localStorage.getItem(ROLE_KEY);

    if (token && email) {
      set({
        status: "authenticated",
        token,
        email,
        role,
        errorMessage: null,
      });
    }
  },
}));
