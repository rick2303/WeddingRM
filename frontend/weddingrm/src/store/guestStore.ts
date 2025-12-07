// store/guestStore.ts
import { create } from "zustand";

export const useGuestStore = create(() => ({
  invite: null,
}));
