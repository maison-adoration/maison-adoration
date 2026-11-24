// Petites actions Svelte pour les mouvements du site (toutes respectent
// « réduire les animations » et ne cachent jamais un contenu déjà visible).

const reduced = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Titre qui monte légèrement la première fois qu'il entre à l'écran. */
export function reveal(node) {
  if (typeof IntersectionObserver === "undefined" || reduced()) return;
  if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return; // déjà visible
  node.classList.add("man-reveal");
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      node.classList.add("is-in");
      io.disconnect();
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  io.observe(node);
  return { destroy: () => io.disconnect() };
}

/**
 * Pastille dorée qui glisse sous l'option choisie d'un groupe.
 * Les options sont les enfants directs du conteneur ; chacune porte un élément
 * [data-on] (true pour l'option choisie) dont la pastille prend la forme.
 */
export function slidePill(node, selected) {
  const pill = document.createElement("span");
  pill.className = "man-pill";
  pill.setAttribute("aria-hidden", "true");
  node.classList.add("has-pill");
  if (getComputedStyle(node).position === "static") node.style.position = "relative";
  node.prepend(pill);

  const place = () => {
    const target = node.querySelector('[data-on="true"]');
    if (!target) { pill.style.opacity = "0"; return; }
    const a = node.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    pill.style.opacity = "1";
    pill.style.width = `${b.width}px`;
    pill.style.height = `${b.height}px`;
    pill.style.borderRadius = getComputedStyle(target).borderRadius;
    pill.style.transform = `translate(${b.left - a.left}px, ${b.top - a.top}px)`;
  };
  place();
  requestAnimationFrame(() => pill.classList.add("is-ready"));
  const ro = new ResizeObserver(place);
  ro.observe(node);
  return {
    update() { requestAnimationFrame(place); },
    destroy() { ro.disconnect(); pill.remove(); node.classList.remove("has-pill"); },
  };
}
