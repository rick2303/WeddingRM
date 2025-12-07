// api/publicInvites.ts
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5158";

export type PublicInvite = {
  id: string;
  name: string;
  phone: string;
  token: string;
  status: "pending" | "confirmed" | "rejected";
  expiresAt: string;
};

export type EventInfo = {
  title: string | null;
  subtitle: string | null;
  description: string | null;
  location: string | null;
  dateText: string | null;
  imageUrl: string | null;
};

// ya tienes algo así para la invitación:
export async function fetchInviteByToken(token: string): Promise<PublicInvite> {
  const res = await fetch(`${API_BASE_URL}/api/public/invites/${token}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message ?? "No se pudo cargar la invitación.");
  }

  return data;
}

export async function respondInvite(
  token: string,
  status: "confirmed" | "rejected"
): Promise<PublicInvite> {
  const res = await fetch(
    `${API_BASE_URL}/api/public/invites/${token}/respond`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message ?? "No se pudo registrar tu respuesta.");
  }

  return data;
}

// 🔹 NUEVO: obtener info del evento
export async function fetchEventInfo(): Promise<EventInfo> {
  const res = await fetch(`${API_BASE_URL}/api/settings/event`);

  // si hay algún problema de red o 500/404, lanzamos error
  if (!res.ok) {
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    throw new Error(
      body?.message ?? "No se pudo cargar la información del evento."
    );
  }

  const data = await res.json();

  return {
    title: data.title ?? null,
    subtitle: data.subtitle ?? null,
    description: data.description ?? null,
    location: data.location ?? null,
    dateText: data.dateText ?? null,
    imageUrl: data.imageUrl ?? null,
  };
}
