import React, { useEffect, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

interface PhotoUploadGalleryProps {
    backendUrl?: string;
}

export const ElegantWeddingGallery: React.FC<PhotoUploadGalleryProps> = ({
    backendUrl = API_BASE_URL,
}) => {
    const [showWelcome, setShowWelcome] = useState(false);
    const [files, setFiles] = useState<FileList | null>(null);
    const [uploading, setUploading] = useState(false);
    const [photos, setPhotos] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
    const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

    const loadPhotos = async () => {
        try {
            const res = await fetch(`${backendUrl}/api/photos`);
            if (!res.ok) throw new Error("Error al cargar fotos");
            const data: string[] = await res.json();
            setPhotos(data);
        } catch (err: any) {
            setError(err.message || "Error desconocido");
        }
    };
    useEffect(() => {
        loadPhotos();

        // Modal solo la primera vez
        const seen = localStorage.getItem("weddingGalleryWelcomeSeen");
        if (!seen) {
            setShowWelcome(true);
        }

        const evtSource = new EventSource(`${backendUrl}/api/photos/stream`);
        evtSource.onmessage = (event) => {
            if (event.data === "new_photo") {
                loadPhotos();
            }
        };
        evtSource.onerror = () => console.warn("SSE connection lost");

        return () => evtSource.close();
    }, []);

    useEffect(() => {
        loadPhotos();

        const evtSource = new EventSource(`${backendUrl}/api/photos/stream`);
        evtSource.onmessage = (event) => {
            if (event.data === "new_photo") {
                loadPhotos();
            }
        };
        evtSource.onerror = () => console.warn("SSE connection lost");
        return () => evtSource.close();
    }, []);

    const handleUpload = async () => {
        if (!files || files.length === 0) return;
        setUploading(true);
        setError(null);
        setSuccessMessage(null);

        const formData = new FormData();
        Array.from(files).forEach((file) => formData.append("file", file));

        try {
            const res = await fetch(`${backendUrl}/api/photos/upload`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errText = await res.text();
                throw new Error(errText || "Error al subir archivo");
            }

            setFiles(null);
            setSuccessMessage("¡Fotos subidas correctamente! 🎉");
        } catch (err: any) {
            setError(err.message || "Error desconocido");
        } finally {
            setUploading(false);
        }
    };

    const toggleSelectPhoto = (url: string) => {
        const newSet = new Set(selectedPhotos);
        if (newSet.has(url)) newSet.delete(url);
        else newSet.add(url);
        setSelectedPhotos(newSet);
    };

    const downloadSelectedPhotos = async () => {
        if (selectedPhotos.size === 0) return;
        const zip = new JSZip();
        await Promise.all(
            Array.from(selectedPhotos).map(async (url, idx) => {
                const res = await fetch(url);
                const blob = await res.blob();
                zip.file(`photo_${idx + 1}.jpg`, blob);
            })
        );
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "selected_photos.zip");
    };

    const downloadAllPhotos = async () => {
        const zip = new JSZip();
        await Promise.all(
            photos.map(async (url, idx) => {
                const res = await fetch(url);
                const blob = await res.blob();
                zip.file(`photo_${idx + 1}.jpg`, blob);
            })
        );
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "all_photos.zip");
    };

    return (
        <main className="min-h-screen bg-[#8b9c88]">
            {showWelcome && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div className="bg-white max-w-md w-full mx-4 p-6 rounded-2xl shadow-2xl text-center animate-fade-in">
                        <h3 className="text-2xl font-['Playfair_Display',serif] italic mb-4 text-gray-800">
                            ¡Bienvenidos a nuestro álbum de recuerdos!
                        </h3>

                        <p className="text-gray-600 mb-3">
                            Gracias por acompañarnos en este día tan especial 🤍
                        </p>

                        <p className="text-gray-600 mb-5">
                            Los invitamos a compartir aquí las fotos y momentos que capturen durante el evento.
                            Cada recuerdo que suban formará parte de nuestra historia.
                        </p>

                        <p className="italic text-gray-500 mb-6">
                            Con cariño,<br />
                            <strong>Los novios</strong>
                        </p>

                        <button
                            onClick={() => {
                                localStorage.setItem("weddingGalleryWelcomeSeen", "true");
                                setShowWelcome(false);
                            }}
                            className="bg-blue-500 text-white px-6 py-2 rounded-full hover:bg-blue-600 transition"
                        >
                            Comenzar
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-5xl mx-auto p-6 " >
                <h2 className="text-3xl font-['Playfair_Display',serif] italic  mb-6 text-center text-[#f3f6f3] ">
                    Álbum de Fotos de la Boda
                </h2>

                {error && <p className="text-red-500 mb-4">{error}</p>}
                {successMessage && <p className="text-[#25ff25] mb-4">{successMessage}</p>}

                {/* Área de subida */}
                <div className="border-2 border-dashed border-blue-400 p-6 rounded-lg text-center mb-6 hover:bg-blue-50 transition relative">
                    <p className="text-[#ffffff] mb-2">
                        Carga tus fotos aquí. Puedes seleccionar múltiples archivos.
                    </p>

                    <input
                        id="fileInput"
                        type="file"
                        multiple
                        onChange={(e) => setFiles(e.target.files)}
                        className="hidden"
                    />
                    <label
                        htmlFor="fileInput"
                        className="mt-2 inline-block bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 cursor-pointer"
                    >
                        Seleccionar Fotos
                    </label>

                    <button
                        onClick={handleUpload}
                        disabled={uploading || !files || files.length === 0}
                        className="mt-2 ml-2 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
                    >
                        {uploading ? "Subiendo..." : "Subir Fotos"}
                    </button>

                    {files && files.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-2 mt-4">
                            {Array.from(files).map((file, idx) => (
                                <div
                                    key={idx}
                                    className="w-24 h-24 overflow-hidden rounded shadow border flex items-center justify-center"
                                >
                                    <img
                                        src={URL.createObjectURL(file)}
                                        alt={file.name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Botones de descarga */}
                <div className="flex gap-4 justify-center mb-4">
                    <button
                        onClick={downloadSelectedPhotos}
                        disabled={selectedPhotos.size === 0}
                        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:bg-gray-400"
                    >
                        Descargar seleccionadas
                    </button>
                    <button
                        onClick={downloadAllPhotos}
                        disabled={photos.length === 0}
                        className="bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:bg-gray-400"
                    >
                        Descargar todas
                    </button>
                </div>

                {/* Galería */}
                {photos.length === 0 ? (
                    <p className="text-center text-gray-500">No hay fotos aún</p>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {photos.map((url, idx) => (
                            <div
                                key={idx}
                                className="overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 relative cursor-pointer"
                            >
                                <img
                                    src={url}
                                    alt={`Foto ${idx + 1}`}
                                    className="w-full h-48 object-cover hover:scale-105 transition-transform duration-300"
                                    onClick={() => setLightboxPhoto(url)}
                                />
                                <input
                                    type="checkbox"
                                    className="absolute top-2 left-2 w-5 h-5 accent-blue-500"
                                    checked={selectedPhotos.has(url)}
                                    onChange={() => toggleSelectPhoto(url)}
                                    onClick={(e) => e.stopPropagation()} // evita abrir lightbox al hacer click en checkbox
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Lightbox */}
                {lightboxPhoto && (
                    <div
                        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50"
                        onClick={() => setLightboxPhoto(null)}
                    >
                        <img
                            src={lightboxPhoto}
                            alt="Vista previa"
                            className="max-h-[90%] max-w-[90%] object-contain shadow-lg"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                )}
            </div>
            <footer className="bg-linear-to-b from-allports-900 to-allports-950 text-white pt-20 pb-5 px-6 md:px-8">
                {/* Derechos y enlaces legales */}
                <div className="mt-16 pt-8 border-t border-white/10">
                    <div className="align-center text-center flex flex-col md:flex-row justify-center gap-4 md:gap-0">
                        <p className="text-white/60 text-xs order-2 md:order-1 mt-4 md:mt-0">
                            &copy; {new Date().getFullYear()} QALI-T. Todos los derechos reservados.
                        </p>
                    </div>
                </div>
            </footer>
        </main>

    );
};

export default ElegantWeddingGallery;
