const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ;

export type Invite = {
  id: string;
  name: string;
  phone: string;
  token: string;
  status: "pending" | "confirmed" | "rejected";
  expiresAt: string;
};

async function safeReadJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchInvites(token: string): Promise<Invite[]> {
  const res = await fetch(`${API_BASE_URL}/api/invites`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const body = await safeReadJson(res);

  if (!res.ok) {
    const msg = body?.message ?? "No se pudieron cargar las invitaciones";
    throw new Error(msg);
  }

  return body as Invite[];
}

export async function createInviteApi(
  data: { name: string; phone: string },
  token: string
): Promise<Invite> {
  const res = await fetch(`${API_BASE_URL}/api/invites`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const body = await safeReadJson(res);

  if (!res.ok) {
    const msg = body?.message ?? "No se pudo crear la invitación";
    throw new Error(msg);
  }

  return body as Invite;
}

export async function updateInviteApi(
  id: string,
  data: Partial<Pick<Invite, "name" | "phone" | "status">>,
  token: string
): Promise<Invite> {
  const res = await fetch(`${API_BASE_URL}/api/invites/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  const body = await safeReadJson(res);

  if (!res.ok) {
    const msg = body?.message ?? "No se pudo actualizar la invitación";
    throw new Error(msg);
  }

  return body as Invite;
}

export async function deleteInviteApi(
  id: string,
  token: string
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/invites/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok && res.status !== 404) {
    const body = await safeReadJson(res);
    const msg = body?.message ?? "No se pudo eliminar la invitación";
    throw new Error(msg);
  }
}
