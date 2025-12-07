// components/AdminGuestForm.tsx
import React, { useState } from "react";
import Modal from "./Modal";
import {
  useInviteStore,
  type InviteStoreState,
} from "../store/inviteStore";

interface Props {
  open: boolean;
  close: () => void;
}

export const AdminGuestForm = ({ open, close }: Props) => {
  const createInvite = useInviteStore(
    (state: InviteStoreState) => state.createInvite
  );

  const [form, setForm] = useState({
    name: "",
    phone: "",
  });

  const [generatedLink, setGeneratedLink] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const invite = await createInvite(form.name, form.phone);
    const link = `${window.location.origin}/invite/${invite.token}`;
    setGeneratedLink(link);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLink);
    alert("Enlace copiado");
  };

  const sendWhatsApp = () => {
    const message = encodeURIComponent(
      `Hola ${form.name}! Te enviamos tu invitación a nuestra celebración: ${generatedLink}, por favor confirma tu asistencia ahí. ¡Esperamos verte! `
    );

    window.open(`https://wa.me/${form.phone}?text=${message}`, "_blank");
  };

  const resetFormAndClose = () => {
    setForm({ name: "", phone: "" });
    setGeneratedLink("");
    close();
  };

  return (
    <Modal open={open} close={resetFormAndClose}>

      {!generatedLink ? (

        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Crear Invitación</h2>

          <div>
            <label className="block text-gray-700">Nombre completo</label>
            <input
              name="name"
              required
              value={form.name}
              onChange={handleChange}
              className="w-full p-3 border rounded"
            />
          </div>

          <div>
            <label className="block text-gray-700">Número de celular</label>
            <input
              name="phone"
              required
              value={form.phone}
              placeholder="Ej: +50499998888 o +13051234567"
              onChange={handleChange}
              pattern="^\+(504\d{8}|1\d{10})$"
              title="Usa formato +504######## (8 dígitos) o +1########## (10 dígitos)"
              className="w-full p-3 border rounded"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato permitido: +504######## (8 dígitos) o +1########## (10 dígitos)
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700"
          >
            Generar invitación
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold mb-4">Invitación Creada</h2>

          <p className="text-gray-700 break-all font-medium">
            {generatedLink}
          </p>

          <button
            onClick={copyToClipboard}
            className="w-full py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            Copiar enlace
          </button>

          <button
            onClick={sendWhatsApp}
            className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Enviar por WhatsApp
          </button>

          <button
            onClick={resetFormAndClose}
            className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Cerrar
          </button>
        </div>
      )}
    </Modal>
  );
};
