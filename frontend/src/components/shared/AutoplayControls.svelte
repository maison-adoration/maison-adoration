<script>
  // Bouton pause/lecture + points de progression d'un carrousel (voir utils/autoplay.js).
  export let ap; // store retourné par createAutoplay
  export let what = "Élément"; // « Message », « Ministère »…
  export let dots = true;
  export let small = false;

  $: count = $ap.count;
</script>

<div class="flex items-center gap-1">
  <button
    type="button"
    data-autoplay-control
    class="press flex-none rounded-full border-[1.5px] border-man-bord text-white flex items-center justify-center hover:border-man-ciel"
    class:w-12={!small}
    class:h-12={!small}
    class:w-11={small}
    class:h-11={small}
    aria-label={$ap.on ? "Mettre en pause le défilement" : "Faire défiler automatiquement"}
    on:click={ap.toggle}
  >
    {#if $ap.on}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
    {:else}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
    {/if}
  </button>
  <slot />
  {#if dots && count > 1}
    <div role="group" aria-label="Choisir" class="flex items-center ml-1">
      {#each Array(count) as _, i}
        <button
          type="button"
          class="h-11 min-w-[26px] px-1 flex items-center justify-center"
          aria-label="{what} {i + 1} sur {count}"
          aria-current={$ap.index === i ? "true" : "false"}
          on:click={() => ap.pick(i)}
        >
          <span
            class="relative block h-1.5 rounded-full bg-man-horizon overflow-hidden transition-[width] duration-300 ease-out"
            style="width: {$ap.index === i ? 36 : 8}px"
          >
            {#if $ap.index === i}
              <span
                class="absolute inset-y-0 left-0 bg-man-or"
                style="width: {$ap.progress * 100}%; transition: {$ap.t === 0 || !$ap.running ? 'none' : 'width 1000ms linear'}"
              ></span>
            {/if}
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
