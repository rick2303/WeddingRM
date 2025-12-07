// store/adminStore.ts
import { create } from "zustand";
import { nanoid } from "nanoid";

export interface GuestInvite {
  id: string;
  name: string;
  phone: string;
  token: string;
  status: "pending" | "confirmed" | "rejected";
}

interface AdminStore {
  invites: GuestInvite[];
  addInvite: (name: string, phone: string) => GuestInvite;
  updateStatus: (id: string, status: GuestInvite["status"]) => void;
  getByToken: (token: string) => GuestInvite | undefined;

  // 🔹 nuevos
  updateInvite: (
    id: string,
    data: Partial<Pick<GuestInvite, "name" | "phone" | "status">>
  ) => void;
  removeInvite: (id: string) => void;
}

export const useAdminStore = create<AdminStore>((set, get) => ({
  invites: [],

  addInvite: (name, phone) => {
    const newInvite: GuestInvite = {
      id: nanoid(),
      name,
      phone,
      token: nanoid(10),
      status: "pending",
    };

    set((state) => ({ invites: [...state.invites, newInvite] }));
    return newInvite;
  },

  updateStatus: (id, status) =>
    set((state) => ({
      invites: state.invites.map((i) =>
        i.id === id ? { ...i, status } : i
      ),
    })),

  getByToken: (token) => get().invites.find((i) => i.token === token),

  // 🔹 actualizar nombre / teléfono / estado
  updateInvite: (id, data) =>
    set((state) => ({
      invites: state.invites.map((i) =>
        i.id === id ? { ...i, ...data } : i
      ),
    })),

  // 🔹 eliminar invitación
  removeInvite: (id) =>
    set((state) => ({
      invites: state.invites.filter((i) => i.id !== id),
    })),
}));
