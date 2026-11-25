<script>
  // Fenêtre modale de la charte : fond clair, titre, bouton Fermer ; le focus
  // entre dans la fenêtre à l'ouverture, y reste, puis revient d'où il venait.
  import { fade, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { createEventDispatcher, tick } from "svelte";

  export let show = false;
  export let title = ""; // titre affiché en haut de la fenêtre (facultatif)
  export let withHeight = false;

  const dispatch = createEventDispatcher();
  let dialog;
  let opener = null;

  const onClose = () => dispatch("modalClose");

  $: if (show) open();
  async function open() {
    opener = document.activeElement;
    await tick();
    const first = dialog && dialog.querySelector("input, select, textarea, button, a[href]");
    (first || dialog)?.focus();
  }
  $: if (!show && opener) { opener.focus?.(); opener = null; }

  const onKey = (e) => {
    if (!show) return;
    if (e.key === "Escape") return onClose();
    if (e.key !== "Tab" || !dialog) return;
    const items = [...dialog.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (!items.length) return;
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  const reduce = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
</script>

<svelte:window on:keydown={onKey} />

{#if show}
  <div
    role="presentation"
    on:click|self={onClose}
    transition:fade={{ duration: reduce() ? 0 : 160 }}
    class="on-light fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-man-nuit/70 p-0 sm:p-5"
  >
    <div
      bind:this={dialog}
      tabindex="-1"
      transition:scale={{ start: 0.96, duration: reduce() ? 0 : 200, easing: cubicOut }}
      class="w-full sm:w-[30rem] max-h-[92svh] overflow-auto bg-white text-man-nuit rounded-t-[26px] sm:rounded-[26px] p-6 md:p-7 outline-none"
      style={withHeight ? "height: 75vh !important;" : ""}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Fenêtre"}
    >
      {#if title}<h2 class="font-slab font-bold text-[24px] leading-tight mb-4">{title}</h2>{/if}
      <div class="mb-5">
        <slot />
      </div>
      <button type="button" class="btn-line w-full" on:click={onClose}>Fermer</button>
    </div>
  </div>
{/if}
