<script>
  // Page d'un message : /message?m=<lien>&t=<secondes>
  // Lecteur YouTube avec chapitres, écoute audio seule, reprise là où l'on
  // s'était arrêté, téléchargement, partage WhatsApp au moment précis.
  import { onMount, onDestroy, tick } from "svelte";
  import getVideoId from "get-video-id";
  import api from "../../utils/api";
  import { cdn } from "../../utils/cdn.js";
  import { formatDate } from "../../components/admin/media/upload";
  import { thumbnailFor } from "../../components/media/embed";
  import VideoEmbed from "../../components/media/VideoEmbed.svelte";
  import { clock, duration, messagePath, shareLink, whatsappUrl, downloadUrl, shareOrCopy, loadYouTube } from "../../utils/media";

  let sermon = null;
  let state = "loading"; // loading | ready | missing | error
  let mode = "video"; // video | audio
  let ytId = null;
  let player = null;
  let playerEl;
  let audioEl;
  let current = 0;
  let resumeFrom = 0;
  let poll;
  let shareAtMoment = true;
  let copied = "";
  let startAt = 0;

  const POS_KEY = (id) => `man_pos_${id}`;
  const savePos = (t) => {
    try {
      if (sermon && t > 20) localStorage.setItem(POS_KEY(sermon.id), String(Math.floor(t)));
    } catch {}
  };
  const readPos = (id) => {
    try {
      return Number(localStorage.getItem(POS_KEY(id))) || 0;
    } catch {
      return 0;
    }
  };

  onMount(async () => {
    const q = new URLSearchParams(location.search);
    const slug = q.get("m");
    startAt = Math.max(0, parseInt(q.get("t"), 10) || 0);
    if (!slug) return (state = "missing");
    try {
      sermon = (await api.get(`/media/public/sermons/by-slug/${encodeURIComponent(slug)}`)).data;
    } catch (e) {
      state = e.response && e.response.status === 404 ? "missing" : "error";
      return;
    }
    state = "ready";
    document.title = `${sermon.title} - M.A.N.`;
    api.post(`/media/public/sermons/${sermon.id}/view`).catch(() => {});
    try {
      const v = getVideoId(sermon.video_url || "");
      ytId = v && v.service === "youtube" ? v.id : null;
    } catch {}
    // Reprise : seulement sans moment imposé par le lien partagé.
    const saved = readPos(sermon.id);
    if (!startAt && saved > 30 && (!sermon.duration_seconds || saved < sermon.duration_seconds - 60)) resumeFrom = saved;
    if (!sermon.video_url && sermon.audio_url) mode = "audio";
    await tick();
    if (ytId) mountPlayer(startAt);
    else if (mode === "audio" && startAt && audioEl) audioEl.currentTime = startAt;
    poll = setInterval(() => {
      const t = now();
      if (t != null) {
        current = t;
        if (Math.floor(t) % 5 === 0) savePos(t);
      }
    }, 1000);
  });

  onDestroy(() => {
    clearInterval(poll);
    savePos(current);
    try { player && player.destroy(); } catch {}
  });

  async function mountPlayer(start) {
    try {
      const YT = await loadYouTube();
      player = new YT.Player(playerEl, {
        videoId: ytId,
        width: "100%",
        height: "100%",
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, playsinline: 1, start: Math.floor(start) || undefined, modestbranding: 1 },
      });
    } catch {
      ytId = null; // YouTube injoignable : repli sur le lecteur intégré simple
    }
  }

  const now = () => {
    if (mode === "audio" && audioEl) return audioEl.currentTime;
    if (player && player.getCurrentTime) return player.getCurrentTime();
    return null;
  };

  function seek(t, play = true) {
    current = t;
    if (mode === "audio" && audioEl) {
      audioEl.currentTime = t;
      if (play) audioEl.play().catch(() => {});
    } else if (player && player.seekTo) {
      player.seekTo(t, true);
      if (play) player.playVideo();
    }
    resumeFrom = 0;
  }

  async function setMode(m) {
    if (m === mode) return;
    const t = now() || current;
    if (m === "audio") {
      try { player && player.pauseVideo(); } catch {}
      mode = "audio";
      await tick();
      if (audioEl) {
        audioEl.currentTime = t;
        audioEl.play().catch(() => {});
      }
    } else {
      audioEl && audioEl.pause();
      mode = "video";
      await tick();
      if (player && player.seekTo) player.seekTo(t, true);
    }
  }

  $: chapters = (sermon && sermon.chapters) || [];
  $: activeChapter = chapters.reduce((acc, c, i) => (current >= c.t ? i : acc), -1);
  $: refs = sermon && sermon.scriptures ? sermon.scriptures.split(/\s*;\s*/).filter(Boolean) : [];
  $: moment = Math.floor(current);
  $: link = sermon ? shareLink(sermon.slug, shareAtMoment && moment > 5 ? moment : 0) : "";
  $: shareText = sermon
    ? `${sermon.title}${sermon.preacher ? `, ${sermon.preacher}` : ""}\n${shareAtMoment && moment > 5 ? `À écouter à partir de ${clock(moment)} : ` : ""}${link}`
    : "";
  $: cover = sermon ? sermon.thumbnail_url || thumbnailFor(sermon.video_url) || "/images/design/predication.jpg" : "";

  async function copyOrShare() {
    try {
      const r = await shareOrCopy({ title: sermon.title, text: shareText.replace(link, "").trim(), url: link });
      if (r === "copied") {
        copied = "Lien copié";
        setTimeout(() => (copied = ""), 2500);
      }
    } catch {
      copied = "Copie impossible";
    }
  }
</script>

<svelte:head>
  <title>Message - M.A.N. - Maison D'Adoration Pour les Nations</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="bg-man-nuit pt-28 md:pt-32 pb-8">
  <div class="max-w-[1240px] mx-auto px-5 md:px-10">
    <a href="/mediatheque#sermons" class="inline-flex items-center gap-2 min-h-[44px] text-man-doux font-bold hover:text-white transition-colors duration-150">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      Tous les messages
    </a>

    {#if state === "loading"}
      <div class="mt-4 aspect-video max-w-[900px] rounded-[22px] bg-man-nuit2 animate-pulse" aria-busy="true" aria-label="Chargement du message"></div>
    {:else if state !== "ready"}
      <div class="mt-6 rounded-[26px] bg-man-nuit2 p-8 md:p-12 text-white max-w-[720px]">
        <h1 class="font-slab font-bold text-[30px] leading-tight">{state === "missing" ? "Message introuvable" : "Le message n'a pas pu être chargé"}</h1>
        <p class="mt-3 text-man-doux text-[17px]">{state === "missing" ? "Le lien est peut-être incomplet, ou le message n'est plus en ligne." : "Vérifiez votre connexion, puis rechargez la page."}</p>
        <a href="/mediatheque#sermons" class="btn-or mt-6">Voir tous les messages</a>
      </div>
    {:else}
      <div class="mt-4 grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:gap-8 items-start">
        <div class="min-w-0">
          {#if sermon.video_url && sermon.audio_url}
            <div class="flex flex-wrap items-center gap-3 mb-4">
              <div class="inline-flex rounded-full bg-man-nuit2 p-1" role="group" aria-label="Mode de lecture">
                <button type="button" aria-pressed={mode === "video"} class="min-h-[40px] px-4 rounded-full font-bold text-[15px] transition-colors duration-150 {mode === 'video' ? 'bg-man-or text-man-nuit' : 'text-man-doux hover:text-white'}" on:click={() => setMode("video")}>Vidéo</button>
                <button type="button" aria-pressed={mode === "audio"} class="min-h-[40px] px-4 rounded-full font-bold text-[15px] transition-colors duration-150 {mode === 'audio' ? 'bg-man-or text-man-nuit' : 'text-man-doux hover:text-white'}" on:click={() => setMode("audio")}>Audio seul</button>
              </div>
              <span class="text-sm text-man-doux">L'audio consomme beaucoup moins de données.</span>
            </div>
          {/if}

          {#if ytId}
            <div class="relative w-full rounded-[22px] overflow-hidden bg-black {mode === 'audio' ? 'hidden' : ''}" style="aspect-ratio: 16 / 9;">
              <div class="absolute inset-0"><div bind:this={playerEl}></div></div>
            </div>
          {:else if sermon.video_url && mode === "video"}
            <VideoEmbed url={sermon.video_url} title={sermon.title} />
          {/if}

          {#if sermon.audio_url}
            <div class="rounded-[22px] bg-man-nuit2 p-4 md:p-5 flex gap-4 items-center {mode === 'audio' ? '' : 'hidden'}">
              <img src={cdn(cover, 160)} alt="" class="w-20 h-20 md:w-24 md:h-24 shrink-0 rounded-2xl object-cover" />
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-man-or">Écoute audio</p>
                <!-- svelte-ignore a11y-media-has-caption -->
                <audio bind:this={audioEl} controls preload="metadata" src={sermon.audio_url} class="w-full mt-2" aria-label="Lecture audio : {sermon.title}"></audio>
              </div>
            </div>
          {/if}

          {#if resumeFrom}
            <div class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-man-nuit2 px-4 py-3 text-man-texte" role="status">
              <span>Vous vous étiez arrêté à {clock(resumeFrom)}.</span>
              <button type="button" class="btn-or !min-h-[40px] !px-4" on:click={() => seek(resumeFrom)}>Reprendre</button>
              <button type="button" class="min-h-[40px] px-2 font-bold text-man-doux hover:text-white underline" on:click={() => (resumeFrom = 0)}>Ignorer</button>
            </div>
          {/if}

          <h1 class="mt-6 font-slab font-bold text-[30px] md:text-[42px] leading-[1.1] text-white">{sermon.title}</h1>
          <p class="mt-3 text-[17px] text-man-doux">
            {[formatDate(sermon.sermon_date), sermon.preacher, sermon.series_name, duration(sermon.duration_seconds)].filter(Boolean).join(", ")}
          </p>
          {#if refs.length}
            <ul class="mt-4 flex flex-wrap gap-2" aria-label="Passages bibliques">
              {#each refs as r}<li class="rounded-full border-[1.5px] border-man-trait px-3 py-1.5 text-[15px] font-bold text-man-texte">{r}</li>{/each}
            </ul>
          {/if}
        </div>

        <aside class="flex flex-col gap-4 min-w-0" aria-label="Actions et chapitres">
          <div class="rounded-[22px] bg-man-nuit2 p-5">
            <p class="font-bold text-white">Partager</p>
            {#if ytId || sermon.audio_url}
              <label class="mt-3 flex items-center gap-3 text-man-texte min-h-[44px] cursor-pointer">
                <input type="checkbox" bind:checked={shareAtMoment} class="w-5 h-5 accent-[#E4BE05]" />
                <span>À partir de <span class="tabular-nums font-bold">{clock(moment)}</span></span>
              </label>
            {/if}
            <div class="mt-3 grid gap-2">
              <a class="btn-or w-full" href={whatsappUrl(shareText)} target="_blank" rel="noopener">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.6-1.3a.4.4 0 000-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.7-1.2 2.2 2.2 0 00.2-1.2c-.1-.1-.3-.2-.5-.3z" /></svg>
                Envoyer sur WhatsApp
              </a>
              <button type="button" class="btn-ghost w-full" on:click={copyOrShare}>Copier le lien</button>
              <p class="text-sm text-man-doux min-h-[1.25rem]" role="status" aria-live="polite">{copied}</p>
            </div>
          </div>

          {#if sermon.audio_url || sermon.pdf_url}
            <div class="rounded-[22px] bg-man-nuit2 p-5">
              <p class="font-bold text-white">Télécharger</p>
              <div class="mt-3 grid gap-2">
                {#if sermon.audio_url}
                  <a class="btn-ghost w-full" href={downloadUrl(sermon.audio_url, sermon.title)} download>
                    Audio{sermon.audio_bytes ? ` (${Math.max(1, Math.round(sermon.audio_bytes / 1048576))} Mo)` : ""}
                  </a>
                {/if}
                {#if sermon.pdf_url}<a class="btn-ghost w-full" href={sermon.pdf_url} target="_blank" rel="noopener">Notes du message (PDF)</a>{/if}
              </div>
            </div>
          {/if}

          {#if chapters.length}
            <nav class="rounded-[22px] bg-man-nuit2 p-5" aria-label="Chapitres">
              <p class="font-bold text-white">Chapitres</p>
              <ol class="mt-2">
                {#each chapters as c, i}
                  <li>
                    <button type="button" class="w-full flex items-baseline gap-3 min-h-[44px] py-2 text-left rounded-xl px-2 -mx-2 transition-colors duration-150 hover:bg-man-nuit3 {i === activeChapter ? 'text-man-or' : 'text-man-texte'}"
                      aria-current={i === activeChapter ? "true" : undefined} on:click={() => seek(c.t)}>
                      <span class="tabular-nums text-sm font-bold min-w-[4.5ch] shrink-0">{clock(c.t)}</span>
                      <span class="font-bold">{c.label}</span>
                    </button>
                  </li>
                {/each}
              </ol>
            </nav>
          {/if}
        </aside>
      </div>
    {/if}
  </div>
</div>

{#if state === "ready" && (sermon.description || sermon.related.length)}
  <div class="on-light bg-white py-12 md:py-14">
    <div class="max-w-[1240px] mx-auto px-5 md:px-10">
      {#if sermon.description}
        <div class="max-w-[68ch] text-[17px] leading-relaxed text-[#2B3F5C] whitespace-pre-line">{sermon.description}</div>
      {/if}
      {#if sermon.related.length}
        <h2 class="mt-12 font-slab font-bold text-[28px] md:text-[34px] leading-tight text-man-nuit mb-5">{sermon.series_name ? "Dans la même série et récents" : "Messages récents"}</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {#each sermon.related as r (r.id)}
            <a href={messagePath(r)} data-sveltekit-reload class="rowcard block rounded-[22px] overflow-hidden bg-white border border-[#E1E8F1] transition-colors duration-200 hover:border-man-marine">
              <span class="relative block overflow-hidden" style="aspect-ratio: 16 / 9;">
                <img src={cdn(r.thumbnail_url || thumbnailFor(r.video_url) || "/images/design/predication.jpg", 600)} alt="" class="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                {#if r.duration_seconds}<span class="absolute right-3 bottom-3 rounded-full bg-man-nuit/85 text-white text-sm font-bold px-2.5 py-1">{clock(r.duration_seconds)}</span>{/if}
              </span>
              <span class="block p-5">
                <span class="block font-slab font-bold text-[20px] leading-tight text-man-nuit">{r.title}</span>
                <span class="block mt-2 text-[15px] text-[#4A6285]">{[formatDate(r.sermon_date), r.preacher].filter(Boolean).join(", ")}</span>
              </span>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
