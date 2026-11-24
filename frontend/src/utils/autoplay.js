// Défilement automatique contrôlable par le visiteur (carrousels de l'accueil).
//
// Règles (recommandations W3C pour les carrousels) :
//  - pause tant que la souris est dessus ou que le clavier navigue dedans ;
//  - après un choix du visiteur (point, flèche, glissement), le défilement attend
//    `idle` ms sans nouveau geste puis reprend tout seul ;
//  - seul le bouton pause l'arrête durablement ;
//  - rien ne défile si l'appareil demande moins d'animations, si l'onglet est caché
//    ou si le carrousel n'est pas à l'écran.
import { writable } from "svelte/store";

export function createAutoplay({ count, dur = 6, idle = 8000, initial = 0 }) {
  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let s = { index: initial, t: 0, on: !reduced, hover: false, focus: false, visible: false, hold: 0, count, dur };
  const store = writable(derive(s));
  let timer = null;

  function derive(x) {
    const running = x.on && !x.hover && !x.focus && x.visible && Date.now() >= x.hold;
    return {
      ...x,
      running,
      progress: Math.min(1, x.t / x.dur),
      // l'annonce aux lecteurs d'écran n'a lieu que quand rien ne bouge tout seul
      live: running ? "off" : "polite",
    };
  }
  const set = (patch) => {
    s = { ...s, ...patch };
    store.set(derive(s));
  };

  function tick() {
    const now = Date.now();
    if (!s.on || s.hover || s.focus || !s.visible || now < s.hold || document.hidden) {
      store.set(derive(s));
      return;
    }
    if (s.t >= s.dur) set({ index: (s.index + 1) % s.count, t: 0 });
    else set({ t: s.t + 1 });
  }

  function start() {
    if (!timer && typeof window !== "undefined") timer = setInterval(tick, 1000);
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  const api = {
    subscribe: store.subscribe,
    setCount(n) {
      if (n === s.count) return;
      set({ count: Math.max(1, n), index: Math.min(s.index, Math.max(0, n - 1)) });
    },
    /** Choix du visiteur : suit son choix et attend `idle` ms avant de reprendre. */
    pick(i) {
      const n = s.count;
      set({ index: ((i % n) + n) % n, t: 0, hold: Date.now() + idle });
    },
    next() { api.pick(s.index + 1); },
    prev() { api.pick(s.index - 1); },
    /** Geste en cours (doigt posé) : repousse la reprise. */
    touch() { set({ hold: Date.now() + idle }); },
    toggle() { set({ on: !s.on, t: 0, hold: 0 }); },
    enter() { set({ hover: true }); },
    leave() { set({ hover: false, hold: Date.now() + 2500 }); },
    focusIn(e) {
      // le bouton pause/lecture lui-même ne met pas en pause
      if (e && e.target && e.target.closest && e.target.closest("[data-autoplay-control]")) return;
      set({ focus: true });
    },
    focusOut(e) {
      if (e && e.currentTarget && e.relatedTarget && e.currentTarget.contains(e.relatedTarget)) return;
      set({ focus: false, hold: Date.now() + idle });
    },
    /** Action Svelte : n'avance que si le carrousel est visible à l'écran. */
    observe(node) {
      start();
      let io;
      if (typeof IntersectionObserver !== "undefined") {
        io = new IntersectionObserver((entries) => set({ visible: entries.some((en) => en.isIntersecting) }), {
          threshold: 0.25,
        });
        io.observe(node);
      } else set({ visible: true });
      return {
        destroy() {
          if (io) io.disconnect();
          stop();
        },
      };
    },
  };
  return api;
}

/**
 * Action Svelte de glissement horizontal (doigt ou souris) pour un carrousel.
 * Appelle onMove(dx) pendant le geste, puis onEnd(direction) : -1, 0 ou 1.
 * Un simple appui reste un clic sur la carte.
 */
export function swipe(node, { onMove, onEnd, onStart } = {}) {
  let d = null;
  let justDragged = false;
  const down = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    d = { x: e.clientX, y: e.clientY, t: Date.now(), moved: false, id: e.pointerId };
    onStart && onStart();
  };
  const move = (e) => {
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { d = null; return; } // défilement vertical
      if (Math.abs(dx) > 8) {
        d.moved = true;
        try { node.setPointerCapture(d.id); } catch (err) { /* ignore */ }
      }
    }
    if (d.moved) onMove && onMove(dx);
  };
  const up = (e) => {
    if (!d) return;
    const g = d;
    d = null;
    if (!g.moved) return;
    const dx = e.clientX - g.x;
    const v = dx / Math.max(1, Date.now() - g.t);
    justDragged = true;
    setTimeout(() => (justDragged = false), 60);
    onMove && onMove(0);
    onEnd && onEnd(dx < -60 || v < -0.45 ? 1 : dx > 60 || v > 0.45 ? -1 : 0);
  };
  const click = (e) => {
    if (justDragged) { e.preventDefault(); e.stopPropagation(); }
  };
  node.addEventListener("pointerdown", down);
  node.addEventListener("pointermove", move);
  node.addEventListener("pointerup", up);
  node.addEventListener("pointercancel", up);
  node.addEventListener("click", click, true);
  return {
    update(p) { ({ onMove, onEnd, onStart } = p || {}); },
    destroy() {
      node.removeEventListener("pointerdown", down);
      node.removeEventListener("pointermove", move);
      node.removeEventListener("pointerup", up);
      node.removeEventListener("pointercancel", up);
      node.removeEventListener("click", click, true);
    },
  };
}
