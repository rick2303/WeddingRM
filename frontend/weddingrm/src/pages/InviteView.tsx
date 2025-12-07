// pages/InviteView.tsx
import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  fetchInviteByToken,
  respondInvite,
  type PublicInvite,
} from "../api/publicInvites";

const PHOTOS = ["/Ring.jpeg", "/Couple4.jpeg", "/Couple.jpeg", "/Couple3.jpeg", "/couple2.jpeg"];

type ViewStatus = "loading" | "ready" | "error";

type EventInfo = {
  title?: string;
  subtitle?: string;
  description?: string;
  location?: string;
  dateText?: string;
  imageUrl?: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5158";

const OrnamentDivider: React.FC = () => (
  <div className="flex items-center justify-center gap-4 my-4">
    <span className="h-px w-12 sm:w-16 bg-[#e5e0d4]/70" />
    <span className="text-[10px] sm:text-xs tracking-[0.35em] uppercase text-[#f7f4ee]/80">
      ♥
    </span>
    <span className="h-px w-12 sm:w-16 bg-[#e5e0d4]/70" />
  </div>
);

/** Sección con animación suave al aparecer en viewport */
const AnimatedBlock: React.FC<{
  children: React.ReactNode;
  delay?: number;
}> = ({ children, delay = 0 }) => {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transform transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
    >
      {children}
    </div>
  );
};

const InviteView: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  const WEDDING_DATE = new Date("2025-12-27T19:00:00");

  const [timeLeft, setTimeLeft] = useState({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });

  const [photoIndex, setPhotoIndex] = useState(0);

  // Estado de la invitación
  const [invite, setInvite] = useState<PublicInvite | null>(null);
  const [viewStatus, setViewStatus] = useState<ViewStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);

  // Contador boda
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = WEDDING_DATE.getTime() - now;

      if (diff <= 0) {
        setTimeLeft({
          days: "00",
          hours: "00",
          minutes: "00",
          seconds: "00",
        });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({
        days: String(days).padStart(2, "0"),
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Autoplay del carrusel de fotos
  useEffect(() => {
    const id = setInterval(() => {
      setPhotoIndex((prev) => (prev + 1) % PHOTOS.length);
    }, 5000); // 5 segundos

    return () => clearInterval(id);
  }, []);

  // Cargar invitación por token + info del evento
  useEffect(() => {
    if (!token) return;

    const load = async () => {
      setViewStatus("loading");
      setErrorMessage(null);
      setInfoMessage(null);

      try {
        const data = await fetchInviteByToken(token);
        setInvite(data);
        setViewStatus("ready");

        if (data.status === "confirmed") {
          setInfoMessage("Ya habías confirmado tu asistencia. ¡Gracias! 🎉");
        } else if (data.status === "rejected") {
          setInfoMessage(
            "Ya habías indicado que no podrías asistir. Gracias por avisar 💜"
          );
        }
      } catch (err: any) {
        setErrorMessage(err?.message ?? "No se pudo cargar la invitación.");
        setViewStatus("error");
      }

      // Info del evento
      try {
        const res = await fetch(`${API_BASE_URL}/api/settings/event`);
        if (!res.ok) {
          console.error(
            "No se pudo cargar la información del evento",
            res.status
          );
          return;
        }

        const data: EventInfo = await res.json();
        setEventInfo(data);
      } catch (err) {
        console.error("Error cargando info del evento", err);
      }
    };

    load();
  }, [token]);

  const handleRespond = async (status: "confirmed" | "rejected") => {
    if (!token || !invite) return;

    setActionLoading(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
      const updated = await respondInvite(token, status);
      setInvite(updated);

      if (status === "confirmed") {
        setInfoMessage("¡Gracias por confirmar tu asistencia! 🎉");
      } else {
        setInfoMessage(
          "Hemos registrado que no podrás asistir. Gracias por avisar 💜"
        );
      }
    } catch (err: any) {
      setErrorMessage(
        err?.message ?? "No se pudo registrar tu respuesta. Intenta de nuevo."
      );
    } finally {
      setActionLoading(false);
    }
  };

  const renderStatusLabel = (status: PublicInvite["status"]) => {
    switch (status) {
      case "pending":
        return "Pendiente de respuesta";
      case "confirmed":
        return "Asistencia confirmada";
      case "rejected":
        return "Invitación rechazada";
      default:
        return status;
    }
  };

  // Estados de carga / error con fondo verde también
  if (viewStatus === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#8b9c88] text-[#f7f4ee]">
        <p className="text-sm">Cargando invitación...</p>
      </main>
    );
  }

  if (viewStatus === "error" || !invite) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#8b9c88] text-[#f7f4ee] px-4">
        <div className="bg-white/95 rounded-2xl shadow-lg max-w-md w-full p-6 text-center text-slate-800">
          <h1 className="text-xl font-semibold mb-3">
            No se pudo cargar la invitación
          </h1>
          <p className="text-gray-600 mb-4">
            {errorMessage ??
              "Ocurrió un error al intentar mostrar tu invitación."}
          </p>
          <p className="text-xs text-gray-400">
            Si crees que esto es un error, contacta a los organizadores.
          </p>
        </div>
      </main>
    );
  }

  const isPending = invite.status === "pending";

  // VISTA PRINCIPAL UNIFICADA
  return (
    <main className="min-h-screen relative overflow-hidden bg-[#8b9c88] text-[#f7f4ee]">
      {/* FONDO: degradados + flores/nature en varias capas */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(circle at 0 0, rgba(255,255,255,0.20), transparent 55%),
            radial-gradient(circle at 100% 0, rgba(243,237,225,0.18), transparent 55%),
            radial-gradient(circle at 0 100%, rgba(241,233,220,0.16), transparent 55%),
            radial-gradient(circle at 100% 100%, rgba(248,242,231,0.18), transparent 55%)
          `,
        }}
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Esquina superior izquierda - nature grande */}
        <img
          src="/nature.png"
          alt=""
          className="hidden sm:block absolute -top-24 -left-16 w-60 opacity-30 mix-blend-soft-light -rotate-3"
        />

        {/* Esquina superior derecha - flower + nature superpuestas */}
        <img
          src="/flower.png"
          alt=""
          className="absolute -top-14 -right-12 w-40 opacity-28 mix-blend-soft-light rotate-6"
        />
        <img
          src="/nature.png"
          alt=""
          className="hidden sm:block absolute -top-10 -right-4 w-32 opacity-18 mix-blend-soft-light blur-sm -rotate-2"
        />

        {/* Lado izquierdo centro - dos flores en columna */}
        <img
          src="/flower.png"
          alt=""
          className="hidden sm:block absolute top-1/4 -left-10 w-32 opacity-22 mix-blend-soft-light -rotate-6"
        />
        <img
          src="/flower.png"
          alt=""
          className="hidden sm:block absolute top-1/2 -left-16 w-40 opacity-18 mix-blend-soft-light rotate-4"
        />

        {/* Lado derecho centro - nature espejo */}
        <img
          src="/nature.png"
          alt=""
          className="hidden sm:block absolute top-[30%] -right-14 w-44 opacity-22 mix-blend-soft-light rotate-2"
        />
        <img
          src="/nature.png"
          alt=""
          className="hidden sm:block absolute top-[65%] -right-16 w-48 opacity-16 mix-blend-soft-light -scale-x-100 -rotate-4"
        />

        {/* Fondo detrás del hero (muy suave) */}
        <img
          src="/flower.png"
          alt=""
          className="absolute top-10 left-1/2 -translate-x-1/2 w-64 opacity-10 mix-blend-soft-light blur-sm"
        />

        {/* Pequeños acentos florales extra en el centro */}
        <img
          src="/flower.png"
          alt=""
          className="hidden sm:block absolute top-1/3 left-1/4 w-32 opacity-14 mix-blend-soft-light rotate-2"
        />
        <img
          src="/nature.png"
          alt=""
          className="hidden sm:block absolute top-2/3 left-1/3 w-36 opacity-12 mix-blend-soft-light -rotate-3"
        />

        {/* Abajo izquierda - combinación nature + flower */}
        <img
          src="/nature.png"
          alt=""
          className="absolute -bottom-20 -left-10 w-52 opacity-26 mix-blend-soft-light -rotate-2"
        />
        <img
          src="/flower.png"
          alt=""
          className="absolute -bottom-12 left-6 w-32 opacity-20 mix-blend-soft-light rotate-3"
        />

        {/* Abajo derecha - remate suave */}
        <img
          src="/flower.png"
          alt=""
          className="absolute -bottom-16 -right-8 w-40 opacity-24 mix-blend-soft-light -rotate-3"
        />
        <img
          src="/nature.png"
          alt=""
          className="hidden sm:block absolute -bottom-24 right-10 w-40 opacity-14 mix-blend-soft-light blur-sm"
        />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-10 space-y-10">
        {/* HERO – MONOGRAMA + VERSÍCULO */}
        <AnimatedBlock delay={60}>
          <section className="text-center space-y-6">
            <div className="flex items-center justify-center gap-6 sm:gap-10">
              {/* Inicial izquierda */}
              <span className="text-6xl sm:text-7xl font-['Great_Vibes',cursive] leading-none">
                R
              </span>

              {/* Corazón con barras verticales arriba y abajo */}
              <div className="flex flex-col items-center justify-center gap-2 sm:gap-3">
                <span className="w-px h-6 sm:h-8 bg-[#f7f4ee]/70" />
                <svg
                  viewBox="0 0 24 24"
                  className="w-9 h-9 sm:w-11 sm:h-11 text-[#f7f4ee]"
                >
                  <path
                    d="M12 20s-5.5-3.2-8.1-6.1C2.3 12.1 2 10.9 2 9.8 2 7.7 3.6 6 5.7 6c1.1 0 2.2.5 3 1.4L12 10l3.3-2.6C16.1 6.5 17.2 6 18.3 6 20.4 6 22 7.7 22 9.8c0 1.1-.3 2.3-1.9 4.1C17.5 16.8 12 20 12 20z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="w-px h-6 sm:h-8 bg-[#f7f4ee]/70" />
              </div>

              {/* Inicial derecha */}
              <span className="text-6xl sm:text-7xl font-['Great_Vibes',cursive] leading-none">
                M
              </span>
            </div>
            <p className="mt-2 text-md sm:text-md leading-relaxed max-w-lg mx-auto font-['Montserrat',sans-serif]">
              <span className="italic">
                “Por encima de todo, vístanse de amor, que es el vínculo perfecto..”
              </span>
              <br />
              <span className="mt-2 inline-block text-[16px] sm:text-md opacity-80 tracking-[0.2em] uppercase">
                Colosenses 3:14
              </span>
            </p>

            <div className="space-y-1 font-['Montserrat',sans-serif]">
              <p className="text-2xl sm:text-3xl font-['Playfair_Display',serif] italic uppercase">
                Nuestra boda
              </p>
              <p className="text-[16px] sm:text-md opacity-80">
                Con alegría en el corazón, queremos compartir este día con usted.
              </p>
            </div>
          </section>
        </AnimatedBlock>

        <OrnamentDivider />

        {/* FOTO – CARRUSEL SUAVE */}
        <AnimatedBlock delay={120}>
          <section className="flex justify-center">
            <div className="bg-white rounded-3xl shadow-xl overflow-hidden max-w-sm w-full">
              <div className="relative w-full aspect-4/5 bg-[#d3c8bb] overflow-hidden">
                {PHOTOS.map((src, index) => (
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className={`
                      absolute inset-0 w-full h-full object-cover
                      transition-all duration-1200 ease-in-out
                      ${index === photoIndex
                        ? "opacity-100 scale-105"
                        : "opacity-0 scale-100"
                      }
                    `}
                  />
                ))}

                {/* indicador inferior opcional */}
                <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
                  {PHOTOS.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setPhotoIndex(index)}
                      className={`
                        h-1.5 rounded-full transition-all duration-300
                        ${index === photoIndex
                          ? "bg-white/90 w-3"
                          : "bg-white/40 w-1.5"
                        }
                      `}
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </AnimatedBlock>

        {/* NOSOTROS */}
        <AnimatedBlock delay={180}>
          <section className="text-center space-y-3">
            <div className="space-y-2 font-['Montserrat',sans-serif]">

              <h2 className="text-5xl sm:text-5xl font-['Great_Vibes',cursive] leading-none">
                Ricardo &amp;  Mitchell
              </h2>
            </div>
          </section>
        </AnimatedBlock>

        <OrnamentDivider />

        {/* EVENTO */}
        <AnimatedBlock delay={220}>
          <section className="text-center space-y-7">
            <div className="space-y-3 pt-2">
              <p className="text-2xl sm:text-3xl font-['Playfair_Display',serif] italic">
                Falta para la boda
              </p>

              <div className="flex justify-center gap-4 sm:gap-6">
                {[
                  { label: "Días", value: timeLeft.days },
                  { label: "Horas", value: timeLeft.hours },
                  { label: "Min", value: timeLeft.minutes },
                  { label: "Seg", value: timeLeft.seconds },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className="text-2xl sm:text-3xl font-['Playfair_Display',serif]">
                      {item.value}
                    </p>
                    <span className="text-[10px] sm:text-xs tracking-widest uppercase font-['Montserrat',sans-serif]">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <OrnamentDivider />

            <div className="text-xs sm:text-sm space-y-1 font-['Montserrat',sans-serif]">
              <p className="text-2xl sm:text-3xl font-['Playfair_Display',serif] italic">
                Celebración
              </p>
              <p className="font-medium text-md sm:text-base">19:00 PM</p>
              <p className="text-sm font-semibold">
                {eventInfo?.location ?? "Olanchito, Yoro. Frente a residencial Vista Verde."}
              </p>
              <p className="text-[16px] sm:text-sm opacity-90 max-w-xs mx-auto">
                {eventInfo?.dateText ??
                  "Sábado 27 de diciembre 7:00pm"}
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <a
                href="https://maps.app.goo.gl/diFbMwgEiouQUE3DA"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-full bg-white text-[#526456] text-xs sm:text-sm font-['Montserrat',sans-serif] font-medium tracking-wide shadow-sm hover:bg-[#f6f2eb]"
              >
                <img
                  src="/placeholder.png"
                  alt=""
                  className="w-4 h-4 sm:w-5 sm:h-5 mr-2"
                />
                Ver ubicación
              </a>
            </div>
          </section>
        </AnimatedBlock>
        <OrnamentDivider />

        {/* CÓDIGO VESTIMENTA */}
        <AnimatedBlock delay={260}>
          <section className="text-center space-y-4 pt-2 font-['Montserrat',sans-serif]">
            <p className="text-2xl sm:text-3xl font-['Playfair_Display',serif] italic">
              Código de vestimenta
            </p>

            <div className="space-y-2">
              <p className="text-md sm:text-md uppercase tracking-[0.18em]">
                Formal
              </p>
              <p className="text-[16px] sm:text-sm opacity-85 max-w-xs mx-auto">
                Los colores verde y blanco están reservados para la decoración y los novios.              </p>

              <div className="flex justify-center pt-1">
                <img
                  src="/bridal-shower.png"
                  alt="Traje y vestido de cóctel"
                  className="w-10 h-10 sm:w-12 sm:h-12"
                />
              </div>
            </div>
          </section>
        </AnimatedBlock>

        {/* SOLO ADULTOS */}
        <AnimatedBlock delay={280}>
          <section className="text-center space-y-3 pt-1 font-['Montserrat',sans-serif]">
            <p className="text-2xl sm:text-3xl font-['Playfair_Display',serif] italic">
              Un detalle importante
            </p>
            <p className="text-sm sm:text-sm max-w-md mx-auto leading-relaxed text-[#f7f4ee]/90">
              Los niños son muy importantes para nosotros pero para que todos puedan disfrutar de una velada tranquila y segura, hemos decidido que la celebración sea {" "}
              <span className="font-semibold">solo para adultos</span>.
              Agradecemos mucho tu comprensión y cariño.
            </p>
          </section>
        </AnimatedBlock>

        <OrnamentDivider />

        {/* REGALO / DETALLES */}
        <AnimatedBlock delay={300}>
          <div className="relative text-center space-y-6">
            <h2 className="text-2xl sm:text-3xl font-['Playfair_Display',serif] italic">
              Regalos
            </h2>

            <p className="max-w-sm mx-auto text-sm sm:text-base leading-relaxed font-['Montserrat',sans-serif]">
              Lo más importante es tu presencia, pero si deseas hacernos un
              regalo, puedes hacerlo en un sobre el día del evento.
            </p>

          </div>
        </AnimatedBlock>
        <OrnamentDivider />

        <AnimatedBlock delay={280}>
          <p className="text-2xl sm:text-3xl font-['Playfair_Display',serif] italic text-center">
            Confirmación de asistencia
          </p>
        </AnimatedBlock>
        {/* CARD DE CONFIRMACIÓN DE ASISTENCIA */}
        <AnimatedBlock delay={340}>
          <section className="pt-4 font-['Montserrat',sans-serif]">
            <div className="bg-white/95 rounded-2xl shadow-lg max-w-md mx-auto w-full overflow-hidden text-slate-900">
              {/* Imagen del evento (si hay) */}
              {eventInfo?.imageUrl && (
                <div className="h-48 w-full overflow-hidden">
                  <img
                    src={eventInfo.imageUrl}
                    alt={eventInfo.title ?? "Foto del evento"}
                    className="w-full h-full object-cover "
                  />
                </div>
              )}

              <div className="p-6 sm:p-8">
                {/* Encabezado del evento */}
                <div className="text-center mb-4">
                  <h1 className="text-2xl font-bold text-slate-900 font-['Playfair_Display',serif] italic">
                    {eventInfo?.title ?? "Invitación al evento"}
                  </h1>
                  {eventInfo?.subtitle && (
                    <p className="text-sm text-slate-500 mt-1 ">
                      {eventInfo.subtitle}
                    </p>
                  )}
                </div>

                {/* Texto de saludo */}
                <p className="text-gray-700 mb-2 font-['Montserrat',sans-serif]">
                  Hola,{" "}
                  <span className="font-semibold text-slate-900 ">
                    {invite.name}
                  </span>{" "}
                  💌
                </p>

                <p className="text-gray-600 mb-4 font-['Montserrat',sans-serif]">
                  {eventInfo?.description ??
                    "Has recibido una invitación especial. Por favor, confirma si podrás acompañarnos."}
                </p>

                {/* Info del evento (lugar y fecha) */}
                {(eventInfo?.location || eventInfo?.dateText) && (
                  <div className="mb-1 space-y-1 text-md font-['Montserrat',sans-serif]">
                    {eventInfo.location && (
                      <p className="text-slate-700">
                        <span className="font-semibold">Lugar: </span>
                        {eventInfo.location}
                      </p>
                    )}
                    {eventInfo.dateText && (
                      <p className="text-slate-700">
                        <span className="font-semibold ">Fecha y hora: </span>
                        {eventInfo.dateText}
                      </p>
                    )}
                  </div>
                )}

                <div className="mb-2">
                  <p className="mt-1 text-md font-semibold text-slate-800 font-['Montserrat',sans-serif]">
                    <span className="text-md font-medium text-gray-600 ">
                      Estado:{" "}
                    </span>
                    {renderStatusLabel(invite.status)}
                  </p>
                </div>

                <p className="text-xs text-gray-500 mb-4">
                  Válida hasta:{" "}
                  {new Date(invite.expiresAt).toLocaleString("es-HN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>

                {infoMessage && (
                  <div className="mb-4 rounded bg-emerald-50 text-emerald-700 px-3 py-2 text-sm font-['Montserrat',sans-serif]">
                    {infoMessage}
                  </div>
                )}

                {errorMessage && (
                  <div className="mb-4 rounded bg-red-50 text-red-700 px-3 py-2 text-sm font-['Montserrat',sans-serif]">
                    {errorMessage}
                  </div>
                )}

                {isPending ? (
                  <div className="flex flex-col sm:flex-row gap-3 mt-4">
                    <button
                      disabled={actionLoading}
                      onClick={() => handleRespond("confirmed")}
                      className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60 text-sm font-medium font-['Montserrat',sans-serif]"
                    >
                      {actionLoading ? "Enviando..." : "Sí, asistiré 🎉"}
                    </button>

                    <button
                      disabled={actionLoading}
                      onClick={() => handleRespond("rejected")}
                      className="flex-1 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-60 text-sm font-medium font-['Montserrat',sans-serif]"
                    >
                      No podré asistir
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 mt-4 text-center font-['Montserrat',sans-serif]">
                    Si necesitas cambiar tu respuesta, por favor contacta a los
                    organizadores.
                  </p>
                )}
              </div>
            </div>
          </section>
        </AnimatedBlock>

        {/* FOOTER */}
        <AnimatedBlock delay={380}>
          <footer className="pt-4 text-center text-[16px] text-[#e5e0d4] font-['Playfair_Display',serif] italic">
            Con amor,  Ricardo &amp; Mitchell
          </footer>
        </AnimatedBlock>
      </div>
    </main>
  );
};

export default InviteView;
