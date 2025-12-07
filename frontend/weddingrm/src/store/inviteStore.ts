// store/inviteStore.ts
import { create } from "zustand";
import {
  fetchInvites,
  createInviteApi,
  updateInviteApi,
  deleteInviteApi,
  type Invite,
} from "../api/invites";
import { useAuthStore } from "./authStore";

export type InviteStatusState = "idle" | "loading" | "error";

export interface InviteStoreState {
  invites: Invite[];
  status: InviteStatusState;
  errorMessage: string | null;

  loadInvites: () => Promise<void>;
  createInvite: (name: string, phone: string) => Promise<Invite>;
  updateInvite: (
    id: string,
    data: Partial<Pick<Invite, "name" | "phone" | "status">>
  ) => Promise<Invite>;
  deleteInvite: (id: string) => Promise<void>;
}

export const useInviteStore = create<InviteStoreState>((set) => ({
  invites: [],
  status: "idle",
  errorMessage: null,

  async loadInvites() {
    try {
      set({ status: "loading", errorMessage: null });
      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error("No hay token de autenticación");
      }

      const data = await fetchInvites(token);
      set({ invites: data, status: "idle", errorMessage: null });
    } catch (err: any) {
      console.error(err);
      set({
        status: "error",
        errorMessage: err?.message ?? "Error al cargar invitaciones",
      });
    }
  },

  async createInvite(name, phone) {
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error("No hay token de autenticación");
      }

      const invite = await createInviteApi({ name, phone }, token);

      set((state) => ({
        invites: [...state.invites, invite],
      }));

      return invite;
    } catch (err: any) {
      console.error(err);
      throw new Error(err?.message ?? "No se pudo crear la invitación");
    }
  },

  async updateInvite(id, data) {
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error("No hay token de autenticación");
      }

      const updated = await updateInviteApi(id, data, token);

      set((state) => ({
        invites: state.invites.map((i) => (i.id === id ? updated : i)),
      }));

      return updated;
    } catch (err: any) {
      console.error(err);
      throw new Error(err?.message ?? "No se pudo actualizar la invitación");
    }
  },

  async deleteInvite(id) {
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        throw new Error("No hay token de autenticación");
      }

      await deleteInviteApi(id, token);

      set((state) => ({
        invites: state.invites.filter((i) => i.id !== id),
      }));
    } catch (err: any) {
      console.error(err);
      throw new Error(err?.message ?? "No se pudo eliminar la invitación");
    }
  },
}));
