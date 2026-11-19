<script>
  import Container from "./../utils/Container.svelte";
  import { scale } from "svelte/transition";
  import { createEventDispatcher } from "svelte";

  export let show = false;

  const dispatch = createEventDispatcher();

  const onClose = () => {
    dispatch("modalClose");
  };
</script>

{#if show}
  <div
    on:click|self={onClose}
    transition:scale
    class="fixed top-0 left-0 md:bottom-0 right-0 h-[130vh] md:h-full w-full z-[999] bg-brand-white"
  >
    <button
      class="fixed top-[.5rem] right-[.5rem] z-[998] btn !px-1 !py-0 !h-[2.5rem] !text-gray-800 !bg-brand-white"
      title="Fermer"
      on:click={() => onClose()}
    >
      <ion-icon name="close-outline" class="text-3xl"></ion-icon>
    </button>

    <div class="w-full">
      <slot />
    </div>
  </div>
{/if}
