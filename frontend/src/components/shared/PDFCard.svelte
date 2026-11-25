<script>
  import { cdn } from "../../utils/cdn.js";
  import PayModal from "./PayModal.svelte";
  import { createEventDispatcher } from "svelte";
  import config from "../../stores/config";

  const dispatch = createEventDispatcher();

  export let isLoggedIn;
  export let id;
  export let title;
  export let type = "pdf";
  export let description;
  export let price;
  export let posterUrl;
  export let url = null;
  export let hasAccess = false;

  let showPayModal = false;
  const TYPE_LABEL = { video: "Vidéo", podcast: "Podcast", activity: "Activité", pdf: "Livre (PDF)" };
</script>

<article class="h-full flex flex-col rounded-[22px] overflow-hidden bg-white border border-[#E1E8F1]">
  <div class="relative">
    <img src={cdn(posterUrl, 600)} alt="" loading="lazy" class="w-full aspect-[16/9] object-cover" />
    {#if !hasAccess}
      <span class="absolute left-3 top-3 rounded-full bg-man-nuit/85 px-3 py-1 text-sm font-bold text-white">
        {price > 0 ? `${price} ${$config.settings.currency || "USD"}` : "Gratuit"}
      </span>
    {/if}
  </div>
  <div class="flex-1 flex flex-col gap-2 p-5">
    <span class="text-sm font-bold text-man-marine">{TYPE_LABEL[type] || "Contenu"}</span>
    <h3 class="font-slab font-bold text-[22px] leading-tight text-man-nuit line-clamp-2">{title}</h3>
    <p class="text-[15px] leading-relaxed text-[#4A6285] line-clamp-3 whitespace-pre-line">{description}</p>
    <div class="mt-auto pt-3">
      {#if !hasAccess && !isLoggedIn}
        <a href="/login" class="btn-line w-full">Se connecter pour accéder</a>
      {:else if !hasAccess}
        <button type="button" class="btn-or w-full !min-h-[48px]" on:click={() => (showPayModal = true)}>
          {price > 0 ? `Acheter pour ${price} ${$config.settings.currency || "USD"}` : "Obtenir"}
        </button>
      {:else}
        <a href={url} rel="external" target="_blank" class="btn-or w-full !min-h-[48px]">Télécharger le PDF</a>
      {/if}
    </div>
  </div>
</article>

<PayModal
  show={showPayModal}
  contentId={id}
  {title}
  {price}
  on:modalClose={() => (showPayModal = false)}
  on:paid={() => dispatch("update")}
/>
