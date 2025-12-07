// components/ExportInvitesButton.tsx
import { useInviteStore } from "../store/inviteStore";

interface ExportInvitesButtonProps {
  className?: string;
}

const ExportInvitesButton = ({ className = "" }: ExportInvitesButtonProps) => {
  const invites = useInviteStore((s) => s.invites);

  const handleExport = () => {
    if (!invites.length) {
      alert("No hay invitaciones para exportar.");
      return;
    }

    const headers = ["id", "name", "phone", "token", "status", "invite_link"];

    const escapeCsv = (value: unknown) => {
      if (value === null || value === undefined) return '""';
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    };

    const origin = window.location.origin;

    const rows = invites.map((i) => {
      const link = `${origin}/invite/${i.token}`;
      return [
        escapeCsv(i.id),
        escapeCsv(i.name),
        escapeCsv(i.phone),
        escapeCsv(i.token),
        escapeCsv(i.status),
        escapeCsv(link),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\r\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `invitaciones-${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={
        "bg-emerald-600 text-white px-5 py-3 rounded-lg shadow hover:bg-emerald-700 disabled:opacity-60 " +
        className
      }
      disabled={!invites.length}
    >
      Exportar invitaciones (.csv)
    </button>
  );
};

export default ExportInvitesButton;
