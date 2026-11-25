<script>
  // Message d'erreur ou de confirmation en tête de formulaire, annoncé aux lecteurs d'écran.
  export let message = "";
  export let kind = "error"; // error | success | info
  export let light = false;
  const COLORS = {
    error: { dark: "bg-[#3A1820] border-[#FF8A7A] text-[#FFD6CF]", light: "bg-[#FDECEA] border-[#B3261E] text-[#7A1A14]" },
    success: { dark: "bg-[#143326] border-[#5BD69A] text-[#CFF5E1]", light: "bg-[#E7F6EE] border-[#1E7A4C] text-[#0F4A2D]" },
    info: { dark: "bg-man-nuit2 border-man-ciel text-man-texte", light: "bg-[#EAF3FB] border-man-marine text-man-nuit" },
  };
</script>

<div role={kind === "error" ? "alert" : "status"} aria-live="polite">
  {#if message}
    <p class="man-pop rounded-2xl border-l-4 px-4 py-3 text-[15px] leading-relaxed {COLORS[kind][light ? 'light' : 'dark']}">{message}</p>
  {/if}
</div>
