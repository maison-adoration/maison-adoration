// Client HTTP unique pour parler à l'API.
// Le jeton de connexion est ajouté automatiquement à chaque requête.
import axios from "axios";

export const API_URL = (
  import.meta.env.VITE_API_URL || "https://maison-adoration.onrender.com"
).replace(/\/$/, "");

const TOKEN_KEY = "man_token";

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("jwt"); // ancien format, plus valable
  } catch {
    /* stockage indisponible */
  }
};

const api = axios.create({ baseURL: API_URL, timeout: 60000 });

api.interceptors.request.use((cfg) => {
  const token = getToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Jeton expiré ou invalide : on l'oublie.
    if (err.response && err.response.status === 401) setToken(null);
    return Promise.reject(err);
  },
);

/** Message d'erreur lisible renvoyé par l'API. */
export const errorMessage = (err, fallback = "Une erreur s'est produite, réessayez.") =>
  (err && err.response && err.response.data && err.response.data.error) ||
  (err && err.code === "ECONNABORTED" ? "Le serveur met trop de temps à répondre, réessayez." : fallback);

/** Types de contenus : valeur envoyée à l'API → libellé affiché. */
export const CONTENT_TYPES = [
  { value: "activity", label: "Activité" },
  { value: "podcast", label: "Podcast" },
  { value: "video", label: "Vidéo" },
  { value: "pdf", label: "Livre (PDF)" },
];

export const typeLabel = (value) =>
  (CONTENT_TYPES.find((t) => t.value === value) || {}).label || value;

export default api;
