// Images hébergées sur Cloudinary : on demande une version redimensionnée
// (largeur maximale) dans le meilleur format du navigateur (WebP/AVIF) et une
// qualité automatique, au lieu de télécharger l'original (souvent plusieurs Mo).
// Les autres adresses (images du site, miniatures YouTube…) sont rendues telles quelles.
export function cdn(url, width = 800) {
  if (!url || typeof url !== "string") return url;
  const marker = "/image/upload/";
  if (!url.includes("res.cloudinary.com") || !url.includes(marker) || url.includes("f_auto")) return url;
  const w = Math.round(width * 2); // écrans haute densité
  return url.replace(marker, `${marker}f_auto,q_auto,c_limit,w_${w}/`);
}

