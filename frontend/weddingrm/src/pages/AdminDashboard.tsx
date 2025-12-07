// pages/AdminDashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminGuestForm } from "../components/AdminGuestForm";
import ExportInvitesButton from "../components/ExportInvitesButton";

import {
  useInviteStore,
  type InviteStoreState,
} from "../store/inviteStore";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5158";

type EditForm = {
  name: string;
  phone: string;
  status: "pending" | "confirmed" | "rejected";
};

type FilterStatus = "all" | "pending" | "confirmed" | "rejected";

type EventSettings = {
  title: string;
  subtitle: string;
  description: string;
  location: string;
  dateText: string;
  imageUrl: string;
};

const AdminDashboard = () => {
  const {
    invites,
    loadInvites,
    updateInvite,
    deleteInvite,
    status,
    errorMessage,
  } = useInviteStore((state: InviteStoreState) => state);

  const authToken = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    phone: "",
    status: "pending",
  });

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  // Configuración global de expiración
  const [expirationDate, setExpirationDate] = useState<string>(""); // YYYY-MM-DD
  const [expirationLoading, setExpirationLoading] = useState(false);
  const [expirationSaving, setExpirationSaving] = useState(false);
  const [expirationError, setExpirationError] = useState<string | null>(null);

  // Información del evento
  const [eventSettings, setEventSettings] = useState<EventSettings>({
    title: "",
    subtitle: "",
    description: "",
    location: "",
    dateText: "",
    imageUrl: "",
  });
  const [eventLoading, setEventLoading] = useState(false);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const navigate = useNavigate();

  // Cargar invitaciones, expiración y evento
  useEffect(() => {
    loadInvites();

    const fetchExpiration = async () => {
      if (!authToken) return;

      try {
        setExpirationLoading(true);
        setExpirationError(null);

        const res = await fetch(
          `${API_BASE_URL}/api/settings/invite-expiration`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (res.status === 204) {
          setExpirationDate("");
          return;
        }

        let body: any = null;
        try {
          body = await res.json();
        } catch {
          body = null;
        }

        if (!res.ok) {
          throw new Error(
            body?.message ?? "No se pudo cargar la fecha de expiración."
          );
        }

        if (body?.expiresAt) {
          const iso: string = body.expiresAt;
          setExpirationDate(iso.substring(0, 10)); // YYYY-MM-DD
        }
      } catch (err: any) {
        console.error(err);
        setExpirationError(
          err?.message ?? "No se pudo cargar la fecha de expiración."
        );
      } finally {
        setExpirationLoading(false);
      }
    };

    const fetchEvent = async () => {
      try {
        setEventLoading(true);
        setEventError(null);

        const res = await fetch(`${API_BASE_URL}/api/settings/event`);
        const body = await res.json();

        if (!res.ok) {
          throw new Error(
            body?.message ?? "No se pudo cargar la información del evento."
          );
        }

        setEventSettings({
          title: body.title ?? "",
          subtitle: body.subtitle ?? "",
          description: body.description ?? "",
          location: body.location ?? "",
          dateText: body.dateText ?? "",
          imageUrl: body.imageUrl ?? "",
        });
      } catch (err: any) {
        console.error(err);
        setEventError(
          err?.message ?? "No se pudo cargar la información del evento."
        );
      } finally {
        setEventLoading(false);
      }
    };

    fetchExpiration();
    fetchEvent();
  }, [loadInvites, authToken]);

  const handleSaveExpiration = async () => {
    if (!authToken) {
      alert("No hay token de autenticación.");
      return;
    }

    if (!expirationDate) {
      alert("Selecciona una fecha de expiración.");
      return;
    }

    const dt = new Date(`${expirationDate}T23:59:59`);

    try {
      setExpirationSaving(true);
      setExpirationError(null);

      const res = await fetch(
        `${API_BASE_URL}/api/settings/invite-expiration`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ expiresAt: dt.toISOString() }),
        }
      );

      let body: any = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }

      if (!res.ok) {
        throw new Error(
          body?.message ?? "No se pudo guardar la fecha de expiración."
        );
      }

      alert("Fecha de expiración actualizada.");
    } catch (err: any) {
      console.error(err);
      setExpirationError(
        err?.message ?? "No se pudo guardar la fecha de expiración."
      );
    } finally {
      setExpirationSaving(false);
    }
  };

  // Guardar información del evento
  const handleSaveEvent = async () => {
    if (!authToken) {
      alert("No hay token de autenticación.");
      return;
    }

    try {
      setEventSaving(true);
      setEventError(null);

      const res = await fetch(`${API_BASE_URL}/api/settings/event`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(eventSettings),
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(
          body?.message ?? "No se pudo guardar la información del evento."
        );
      }

      alert("Información del evento actualizada.");
    } catch (err: any) {
      console.error(err);
      setEventError(
        err?.message ?? "No se pudo guardar la información del evento."
      );
    } finally {
      setEventSaving(false);
    }
  };

  const handleEventChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEventSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!authToken) {
      alert("No hay token de autenticación.");
      return;
    }

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setEventError(null);

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE_URL}/api/settings/event-image`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(
          body?.message ?? "No se pudo subir la imagen del evento."
        );
      }

      setEventSettings((prev) => ({
        ...prev,
        imageUrl: body.imageUrl ?? prev.imageUrl,
      }));
    } catch (err: any) {
      console.error(err);
      setEventError(
        err?.message ?? "No se pudo subir la imagen del evento."
      );
    } finally {
      setUploadingImage(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const startEdit = (id: string) => {
    const invite = invites.find((i) => i.id === id);
    if (!invite) return;

    setEditingId(id);
    setEditForm({
      name: invite.name,
      phone: invite.phone,
      status: invite.status,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const saveEdit = async () => {
    if (!editingId) return;

    if (!editForm.name.trim() || !editForm.phone.trim()) {
      alert("Nombre y celular son obligatorios.");
      return;
    }

    await updateInvite(editingId, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      status: editForm.status,
    });

    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("¿Seguro que quieres eliminar esta invitación?")) {
      await deleteInvite(id);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const filteredInvites = invites.filter((i) => {
    if (statusFilter === "all") return true;
    return i.status === statusFilter;
  });

  const filterButtonClasses = (value: FilterStatus) =>
    [
      "px-3 py-1 rounded-full text-xs md:text-sm border transition",
      statusFilter === value
        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100",
    ].join(" ");

  const pendingCount = invites.filter((i) => i.status === "pending").length;
  const confirmedCount = invites.filter((i) => i.status === "confirmed").length;
  const rejectedCount = invites.filter((i) => i.status === "rejected").length;

  const getStatusBadgeClasses = (status: "pending" | "confirmed" | "rejected") =>
    status === "pending"
      ? "bg-amber-100 text-amber-800 border border-amber-200"
      : status === "confirmed"
        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
        : "bg-rose-100 text-rose-800 border border-rose-200";

  const getStatusLabel = (status: "pending" | "confirmed" | "rejected") =>
    status === "pending"
      ? "Pendiente"
      : status === "confirmed"
        ? "Confirmado"
        : "Rechazado";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Panel de Invitaciones
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Gestiona las invitaciones, revisa su estado y configura la fecha
              límite global y los detalles del evento.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg shadow hover:bg-rose-700 text-sm flex items-center gap-2"
          >
            <span className="hidden sm:inline">Cerrar sesión</span>
            <span className="sm:hidden">Salir</span>
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase">
              Total de invitaciones
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {invites.length}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase">
              Confirmadas
            </p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">
              {confirmedCount}
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-100">
            <p className="text-xs font-medium text-slate-500 uppercase">
              Pendientes
            </p>
            <p className="mt-2 text-2xl font-semibold text-amber-500">
              {pendingCount}
            </p>
          </div>
        </div>

        {/* Configuración global de expiración */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-lg text-slate-900">
                Configuración de expiración
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Define una fecha global de expiración para todas las
                invitaciones. Después de esta fecha, el enlace dejará de ser
                válido.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Fecha de expiración
              </label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveExpiration}
              disabled={expirationSaving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 text-sm"
            >
              {expirationSaving ? "Guardando..." : "Guardar"}
            </button>

            {expirationLoading && (
              <span className="text-sm text-slate-500">
                Cargando fecha actual...
              </span>
            )}
          </div>

          {expirationError && (
            <p className="text-sm text-rose-600 mt-2">{expirationError}</p>
          )}
        </div>

        {/* Información del evento */}
        <div className="bg-white rounded-xl shadow-sm p-5 mb-6 border border-slate-100">
          <div className="flex flex-wrap justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-lg text-slate-900">
                Información del evento
              </h2>
              <p className="text-sm text-slate-500 mt-1 max-w-xl">
                Estos datos se mostrarán en la pantalla de invitación que verá
                cada invitado.
              </p>
            </div>
          </div>

          {eventLoading && (
            <p className="text-sm text-slate-500 mb-3">
              Cargando información del evento...
            </p>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Título del evento
                </label>
                <input
                  name="title"
                  value={eventSettings.title}
                  onChange={handleEventChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Boda de Nombre1 & Nombre2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Subtítulo
                </label>
                <input
                  name="subtitle"
                  value={eventSettings.subtitle}
                  onChange={handleEventChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Nos encantaría compartir este día contigo"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fecha (texto)
                </label>
                <input
                  name="dateText"
                  value={eventSettings.dateText}
                  onChange={handleEventChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Sábado 14 de febrero, 4:00 PM"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Lugar
                </label>
                <input
                  name="location"
                  value={eventSettings.location}
                  onChange={handleEventChange}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Salón Real, Tegucigalpa"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descripción
                </label>
                <textarea
                  name="description"
                  value={eventSettings.description}
                  onChange={handleEventChange}
                  rows={5}
                  className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                  placeholder="Comparte con nosotros este día tan especial..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Imagen del evento
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-slate-700"
                />
                {uploadingImage && (
                  <p className="text-xs text-slate-500 mt-1">
                    Subiendo imagen...
                  </p>
                )}

                {eventSettings.imageUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-1">
                      Vista previa:
                    </p>
                    <img
                      src={eventSettings.imageUrl}
                      alt="Evento"
                      className="w-full max-h-52 object-cover rounded-lg border border-slate-200"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleSaveEvent}
              disabled={eventSaving}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 text-sm"
            >
              {eventSaving
                ? "Guardando información..."
                : "Guardar información del evento"}
            </button>
          </div>

          {eventError && (
            <p className="text-sm text-rose-600 mt-2">{eventError}</p>
          )}
        </div>

        {/* Acciones principales */}
        <div className="flex flex-wrap gap-3 items-center mb-4">
          <button
            onClick={() => setOpen(true)}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg shadow hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"
          >
            <span className="text-lg leading-none">＋</span>
            <span>Nueva Invitación</span>
          </button>

          <ExportInvitesButton />
        </div>

        <AdminGuestForm open={open} close={() => setOpen(false)} />

        {/* Filtros por estado */}
        <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-600 font-medium">
            Filtrar por estado:
          </span>

          <button
            type="button"
            className={filterButtonClasses("all")}
            onClick={() => setStatusFilter("all")}
          >
            Todos ({invites.length})
          </button>

          <button
            type="button"
            className={filterButtonClasses("pending")}
            onClick={() => setStatusFilter("pending")}
          >
            Pendientes ({pendingCount})
          </button>

          <button
            type="button"
            className={filterButtonClasses("confirmed")}
            onClick={() => setStatusFilter("confirmed")}
          >
            Confirmados ({confirmedCount})
          </button>

          <button
            type="button"
            className={filterButtonClasses("rejected")}
            onClick={() => setStatusFilter("rejected")}
          >
            Rechazados ({rejectedCount})
          </button>
        </div>

        {status === "loading" && (
          <p className="text-slate-500 mb-2 text-sm">
            Cargando invitaciones...
          </p>
        )}

        {errorMessage && (
          <p className="text-rose-600 mb-2 text-sm">{errorMessage}</p>
        )}

        {/* Lista de invitaciones */}
        <div className="mt-4 space-y-3">
          {filteredInvites.map((i) => {
            const isEditing = editingId === i.id;
            const link = `${origin}/invite/${i.token}`;

            const copyLink = () => {
              navigator.clipboard.writeText(link);
              alert("Enlace copiado");
            };

            const sendWhatsApp = () => {
              const message = encodeURIComponent(
                `Hola ${i.name}! Te enviamos tu invitación a nuestra celebración: ${link}, por favor confirma tu asistencia ahí. ¡Esperamos verte!`
              );
              window.open(`https://wa.me/${i.phone}?text=${message}`, "_blank");
            };

            if (isEditing) {
              return (
                <div
                  key={i.id}
                  className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm space-y-2"
                >
                  <div className="grid md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">
                        Nombre
                      </label>
                      <input
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm text-slate-600 mb-1">
                        Celular
                      </label>
                      <input
                        name="phone"
                        value={editForm.phone}
                        onChange={handleEditChange}
                        pattern="^\\+(504\\d{8}|1\\d{10})$"
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Formato: +504######## o +1##########
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm text-slate-600 mb-1">
                        Estado
                      </label>
                      <select
                        name="status"
                        value={editForm.status}
                        onChange={handleEditChange}
                        className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="pending">Pendiente</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="rejected">Rechazado</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-3">
                    <button
                      onClick={saveEdit}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 text-sm"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={i.id}
                className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm"
              >
                <div className="flex flex-wrap justify-between gap-2 mb-2">
                  <div>
                    <p className="font-semibold text-slate-900">{i.name}</p>
                    <p className="text-xs text-slate-500">
                      Celular: <span className="font-mono">{i.phone}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-right">
                    <span
                      className={
                        "px-2 py-0.5 rounded-full text-xs font-medium " +
                        getStatusBadgeClasses(i.status)
                      }
                    >
                      {getStatusLabel(i.status)}
                    </span>
                    <span className="text-xs text-slate-500">
                      Vence:{" "}
                      {i.expiresAt
                        ? new Date(i.expiresAt).toLocaleDateString()
                        : "Sin fecha"}
                    </span>
                  </div>
                </div>

                <p className="break-all text-xs text-slate-500 mt-1">
                  <span className="font-semibold text-slate-700">Link:</span>{" "}
                  {link}
                </p>

                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    onClick={copyLink}
                    className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs md:text-sm hover:bg-slate-950"
                  >
                    Copiar enlace
                  </button>
                  <button
                    onClick={sendWhatsApp}
                    className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs md:text-sm hover:bg-emerald-700"
                  >
                    Enviar por WhatsApp
                  </button>
                  <button
                    onClick={() => startEdit(i.id)}
                    className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs md:text-sm hover:bg-indigo-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(i.id)}
                    className="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs md:text-sm hover:bg-rose-700"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            );
          })}

          {!filteredInvites.length && status !== "loading" && (
            <p className="text-slate-500 text-sm">
              No hay invitaciones para el filtro seleccionado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
