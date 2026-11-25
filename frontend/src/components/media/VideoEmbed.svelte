<script>
  import { embedUrl } from "./embed";
  export let url;
  export let title = "Vidéo";
  $: src = embedUrl(url);
</script>

{#if src}
  <div class="relative w-full rounded-xl overflow-hidden shadow-lg bg-black" style="aspect-ratio: 16 / 9;">
    <iframe {src} {title} class="absolute inset-0 w-full h-full" frameborder="0" loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen></iframe>
  </div>
{:else if url}
  <a href={url} target="_blank" rel="noopener" class="btn btn-secondary">
    Ouvrir la vidéo <ion-icon aria-hidden="true" name="open-outline" class="text-xl ml-2"></ion-icon>
  </a>
{/if}
