<script>
  import YoutubeVideo from "./YoutubeVideo.svelte";
  import VideoWebinar from "./VideoWebinar.svelte";
  import PayModal from "./PayModal.svelte";
  import { createEventDispatcher } from "svelte";
  import config from "../../stores/config";

  const dispatch = createEventDispatcher();

  export let isLoggedIn;
  export let id;
  export let type;
  export let title;
  export let description;
  export let price;
  export let posterUrl;
  export let url = null;
  export let hasAccess = false;

  let showVideoModal = false;
  let showPayModal = false;
</script>

<div class="">
  <div class="bg-brand-black-light rounded-xl shadow-lg overflow-hidden">
    <div
      style={`background-image: url(${posterUrl}); background-size: cover; background-position: center;`}
    >
      <div
        class="px-3 pt-4 no-h-[12.5rem] aspect-[16/9] flex flex-col justify-between overlay-thin"
      >
        <div class="">
          {#if price > 0}
            <div
              class="h-font py-1 px-2 mr-3 rounded-lg text-white text-base inline-block bg-gradient-to-r from-brand-primary to-brand-second"
            >
              {price} {$config.settings.currency}
            </div>
          {/if}
        </div>
      </div>
    </div>
    <div class="px-3 py-2">
      <h1
        class="flex items-center pb-2 k-font font-bold uppercase text-base text-transparent fill-current bg-clip-text bg-gradient-to-r from-brand-primary to-brand-second"
      >
        <div
          class="rounded-md bg-gradient-to-r from-brand-primary/75 to-brand-second/75 mr-2 shadow-md px-1 py-1 flex items-center justify-center"
        >
          {#if type == "activity"}
            <ion-icon name="calendar-outline" class="text-2xl text-white"
            ></ion-icon>
          {:else if type == "podcast"}
            <ion-icon name="headset-outline" class="text-2xl text-white"
            ></ion-icon>
          {:else if type == "video"}
            <ion-icon name="play-circle-outline" class="text-2xl text-white"
            ></ion-icon>
          {:else if type == "pdf"}
            <ion-icon name="document-text-outline" class="text-2xl text-white"
            ></ion-icon>
          {/if}
        </div>
        {title}
      </h1>
      <div
        class="mb-2 text-gray-700 !text-sm tracking-wider line-clamp-5 overflow-hidden whitespace-pre-line"
      >
        {description}
      </div>

      {#if hasAccess || isLoggedIn}
        <div class="">
          {#if !hasAccess}
            <button
              class="btn btn-black !w-full"
              on:click={() => (showPayModal = true)}
            >
              Payer pour accéder
              <ion-icon name="lock-closed-outline" class="text-xl ml-2"></ion-icon>
            </button>
          {:else}
            <div class="">
              {#if type == "activity"}
                <a href="/#contact" class="btn btn-third !w-full">
                  Nous Contacter
                  <ion-icon name="call-outline" class="text-xl ml-2"></ion-icon>
                </a>
              {:else}
                <button
                  class="btn btn-third !w-full"
                  on:click={() => (showVideoModal = true)}
                >
                  Regarder
                  <ion-icon name="play-circle-outline" class="text-xl ml-2"
                  ></ion-icon>
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {:else}
        <a href="/register" class="!w-full btn btn-black">
          Inscription
          <ion-icon name="create-outline" class="text-xl ml-2"></ion-icon>
        </a>
      {/if}
    </div>
  </div>
</div>

{#if url && type != "activity"}
  <VideoWebinar
    on:modalClose={() => (showVideoModal = false)}
    show={showVideoModal}
  >
    <YoutubeVideo {description} {title} videoURL={url} />
  </VideoWebinar>
{/if}

<PayModal
  show={showPayModal}
  contentId={id}
  {title}
  {price}
  on:modalClose={() => (showPayModal = false)}
  on:paid={() => dispatch("update")}
/>
