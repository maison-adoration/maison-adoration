// Téléchargement d'un export (Excel) renvoyé par l'API avec le jeton de connexion.
import api from "./api";

export async function download(url, filename, params = {}) {
  const res = await api.get(url, { params, responseType: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(res.data);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export const today = () => new Date().toISOString().slice(0, 10);
