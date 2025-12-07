// components/Modal.tsx
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  open: boolean;
  close: () => void;
  children: ReactNode;
}

const Modal = ({ open, close, children }: ModalProps) => {
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md mx-4 bg-white rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={close}
          className="absolute right-3 top-2 text-gray-500 hover:text-gray-700 text-xl"
          aria-label="Cerrar modal"
        >
          ×
        </button>

        <div className="p-6">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
