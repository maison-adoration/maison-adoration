<script>
  import { createEventDispatcher } from "svelte";
  import { fade } from "svelte/transition";
  export let show = false;
  export let title = "";
  const dispatch = createEventDispatcher();
  const close = () => dispatch("close");
  const onKey = (e) => show && e.key === "Escape" && close();
</script>

<svelte:window on:keydown={onKey} />

{#if show}
  <div transition:fade={{ duration: 120 }} class="fixed inset-0 z-[3000] bg-black/80 overflow-y-auto" role="presentation" on:click|self={close}>
    <div class="max-w-4xl mx-auto my-10 px-4" role="dialog" aria-modal="true" aria-label={title}>
      <div class="flex items-center justify-between mb-3 text-white">
        <div class="h-font text-2xl">{title}</div>
        <button class="text-3xl leading-none" title="Fermer" on:click={close}>×</button>
      </div>
      <slot />
    </div>
  </div>
{/if}
