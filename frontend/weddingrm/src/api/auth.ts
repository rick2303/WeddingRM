// api/auth.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  email: string;
  role: string;
  expiresAt: string; // viene como Date en C#, pero lo recibimos como string
}

export async function loginRequest(
  payload: LoginPayload
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // 401 o cualquier otro error
    throw new Error("Credenciales inválidas o error en el servidor");
  }

  const data = (await res.json()) as LoginResponse;
  return data;
}

export async function meRequest(token: string) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error("Token inválido o expirado");
  }

  return res.json();
}
