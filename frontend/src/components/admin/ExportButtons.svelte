<script>
  // Boutons d'export de la gestion : Excel (pour travailler la liste) et PDF (pour imprimer).
  // `url(format)` renvoie l'adresse de l'API ; `params` les filtres en cours.
  import { errorMessage } from "../../utils/api";
  import { download, today } from "../../utils/download";

  export let url; // (format: "xlsx" | "pdf") => string
  export let filename; // sans extension ni date
  export let params = {}; // objet, ou fonction qui renvoie les filtres au moment du clic
  export let dark = false; // sur un fond bleu nuit
  export let pdfLabel = "PDF";

  let busy = "";
  let error = "";

  // « Nuit de louange et d'adoration » → « nuit-de-louange-et-d-adoration »
  const slug = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const run = async (format) => {
    busy = format;
    error = "";
    try {
      await download(url(format), `${slug(filename)}-${today()}.${format}`, typeof params === "function" ? params() : params);
    } catch (err) {
      error = errorMessage(err, "L'export n'a pas pu être préparé. Réessayez.");
    } finally {
      busy = "";
    }
  };
</script>

<div class="flex flex-col items-start gap-1">
  <div class="inline-flex items-center gap-2" role="group" aria-label="Exporter">
    <span class="text-sm font-bold {dark ? 'text-man-doux' : 'text-[#4A6285]'}">Exporter</span>
    <button type="button" class="{dark ? 'btn-or' : 'btn-line'} !min-h-[40px] !px-4 !text-[14px]" on:click={() => run("xlsx")} disabled={Boolean(busy)} aria-busy={busy === "xlsx"}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mr-1.5"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 8l6 8M15 8l-6 8" /></svg>
      {busy === "xlsx" ? "Préparation…" : "Excel"}
    </button>
    <button type="button" class="{dark ? 'btn-ghost' : 'btn-line'} !min-h-[40px] !px-4 !text-[14px]" on:click={() => run("pdf")} disabled={Boolean(busy)} aria-busy={busy === "pdf"}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mr-1.5"><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></svg>
      {busy === "pdf" ? "Préparation…" : pdfLabel}
    </button>
  </div>
  {#if error}<p role="alert" class="text-sm {dark ? 'text-[#FFB4A8]' : 'text-[#B3261E]'}">{error}</p>{/if}
</div>
