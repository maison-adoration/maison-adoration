<script>
  import { Circle } from "svelte-loading-spinners";
  import { fly } from "svelte/transition";
  import { embedUrl } from "../media/embed.js";

  export let videoURL = "https://youtu.be/L6k0bI5KlDw";
  export let title;
  // export let description;

  let showTitle = true;
  let loaded = false;

  // YouTube, Vimeo ou Facebook ; null si le lien ne peut pas être intégré.
  $: src = embedUrl(videoURL);

  const handleOnLoad = () => {
    loaded = true;
  };

  const handleClick = () => {
    if (showTitle) {
      showTitle = false;
    } else {
      showTitle = true;
      setTimeout(() => {
        showTitle = false;
      }, 4000);
    }
  };
</script>

<div class="overflow-hidden shadow-sm h-full w-full min-h-screen relative">
  {#if showTitle}
    <div
      in:fly={{ y: -15 }}
      out:fly={{ y: -15 }}
      class="absolute left-0 top-0 w-full h-[3.5rem] z-30"
    >
      <h1
        class="bg-brand-black text-gray-700 w-full h-full text-sm uppercase tracking-wider flex items-center shadow-md text-center px-2 py-2"
      >
        <ion-icon aria-hidden="true" name="logo-youtube" class="text-xl mr-2"></ion-icon>
        <div class="block sm:hidden text-gray-700 text-xs">
          {title.length < 25 ? title : title.substring(0, 45) + "..."}
        </div>
        <div class="hidden sm:block text-gray-700 text-xs">
          {title.length < 55 ? title : title.substring(0, 65) + "..."}
        </div>
      </h1>
    </div>
  {/if}

  {#if !src}
    <div class="h-[60vh] w-full flex flex-col items-center justify-center pt-12 bg-brand-black-light text-gray-400 text-center px-4">
      Cette vidéo ne peut pas être lue ici.
      <a class="btn btn-third mt-4" href={videoURL} target="_blank" rel="noopener noreferrer">Ouvrir la vidéo</a>
    </div>
  {:else}
  <div
    class:hidden={!loaded}
    class="h-[60vh] md:h-[100vh] w-[100vw] overflow-hidden shadow-sm relative z-10"
  >
    <iframe
      on:load={handleOnLoad}
      {title}
      width="100%"
      height="100%"
      {src}
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
    ></iframe>
  </div>

  <div
    class:hidden={loaded}
    class="h-[60vh] md:h-[100vh] w-[100vw] overflow-hidden shadow-sm relative z-10 pt-12 bg-brand-black-light flex items-center justify-center"
  >
    <Circle size="50" color="#3695cb" unit="px" />
  </div>
  {/if}

  <div
    class="mx-3 text-brand-primary text-xl my-4 pb-3 border-b border-brand-primary border-dotted"
  >
    {title}
  </div>
  <div class="px-3">
    Bienvenue sur le webinar <span class="text-brand-primary">{title}</span>,
    appuyez sur le bouton play
    <ion-icon aria-hidden="true"
      name="play-circle"
      class="text-brand-primary text-base translate-y-1"></ion-icon>
    pour lancer la video. Pour ouvrir la video en plein ecran, cliquez sur ce bouton
    <ion-icon aria-hidden="true" name="scan" class="text-brand-primary text-base translate-y-1"></ion-icon>.
  </div>
</div>
