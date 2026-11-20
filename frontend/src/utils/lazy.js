// Action Svelte : pose l'image de fond seulement quand l'élément approche de
// l'écran (comme loading="lazy" pour les <img>), pour ne pas télécharger dès
// l'ouverture des photos situées plus bas dans la page.
// Usage : <div use:lazyBg={"/images/photo.jpg"}></div>
export function lazyBg(node, url) {
  let current = url;
  let observer;
  const apply = () => {
    // Adresse entre guillemets et échappée : un nom de fichier avec espace,
    // parenthèse ou guillemet ne casse pas le style.
    node.style.backgroundImage = current ? `url("${String(current).replace(/["\\\n\r]/g, encodeURIComponent)}")` : "";
  };
  const watch = () => {
    if (typeof IntersectionObserver === "undefined") return apply();
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          apply();
          observer.disconnect();
          observer = null;
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
  };
  watch();
  return {
    update(next) {
      current = next;
      if (!observer) apply();
    },
    destroy() {
      if (observer) observer.disconnect();
    },
  };
}
