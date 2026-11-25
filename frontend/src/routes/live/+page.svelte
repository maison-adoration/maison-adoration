<script>
  import { reveal } from "../../utils/motion";
  import { onMount, onDestroy } from "svelte";
  import api from "../../utils/api";
  import PageHero from "../../components/pages/PageHero.svelte";
  import { nextService, splitCountdown } from "../../utils/schedule";
  import VideoEmbed from "../../components/media/VideoEmbed.svelte";
  import LiveRoom from "../../components/media/LiveRoom.svelte";
  import { formatDate } from "../../components/admin/media/upload";

  const TYPE = { culte: "Culte", conference: "Conférence", prayer: "Prière", cours: "Cours" };
  let data = null;
  let timer;
  // Compte à rebours vers le prochain culte, quand rien n'est diffusé.
  let next = nextService();
  let tick;
  $: cd = splitCountdown(next.seconds);

  const load = async () => {
    try {
      data = (await api.get("/media/public/live")).data;
    } catch (e) {
      data = data || { live: null, upcoming: [], replays: [] };
    }
  };

  onMount(() => {
    tick = setInterval(() => (next = nextService()), 1000);
    load();
    // Le direct apparaît sans recharger la page (pas de requête si l'onglet est en arrière-plan).
    timer = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
  });
  onDestroy(() => { clearInterval(timer); clearInterval(tick); });
</script>

<svelte:head>
  <title>Direct - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero title="En direct" subtitle="Les cultes en direct, le mercredi, le vendredi et le dimanche." />

<div class="on-light bg-white py-12 md:py-16 min-h-[50vh]">
  <div class="max-w-[1040px] mx-auto px-5 md:px-10">
    {#if data == null}
      <div class="aspect-video rounded-[26px] bg-[#EEF2F8] animate-pulse" aria-busy="true" aria-label="Chargement du direct"></div>
    {:else}
      {#if data.live}
        <section class="mb-14" aria-labelledby="t-live">
          <p class="inline-flex items-center gap-2 font-extrabold text-[#B3261E] mb-2"><span class="man-live w-2.5 h-2.5 rounded-full bg-[#D93025]" aria-hidden="true"></span>En direct{TYPE[data.live.type] ? `, ${TYPE[data.live.type].toLowerCase()}` : ""}</p>
          <h2 id="t-live" class="font-slab font-bold text-[30px] md:text-[40px] leading-tight text-man-nuit mb-5">{data.live.title}</h2>
          <div class="rounded-[22px] overflow-hidden"><VideoEmbed url={data.live.stream_url} title={data.live.title} /></div>
          {#key data.live.id}<LiveRoom stream={data.live} />{/key}
          {#if data.live.description}<p class="mt-5 text-[17px] text-[#2B3F5C] whitespace-pre-line">{data.live.description}</p>{/if}
        </section>
      {:else}
        <section class="mb-14 rounded-[26px] bg-man-nuit text-white overflow-hidden grid md:grid-cols-[1.2fr_1fr]" aria-labelledby="t-next">
          <div class="p-7 md:p-10 flex flex-col gap-4">
            {#if next.live}
              <p class="inline-flex items-center gap-2 font-extrabold text-man-lumiere"><span class="man-live w-2.5 h-2.5 rounded-full bg-man-lumiere" aria-hidden="true"></span>En cours à l'église</p>
              <div>
                <h2 id="t-next" class="font-slab font-bold text-[28px] md:text-[34px] leading-tight">{next.service.name}</h2>
                <p class="text-man-or font-bold mt-1">{next.service.label}</p>
              </div>
              <p class="text-man-doux">La diffusion en ligne n'a pas encore commencé.</p>
            {:else}
              <p class="text-man-doux">Aucune diffusion en ce moment. Prochain rassemblement :</p>
              <div>
                <h2 id="t-next" class="font-slab font-bold text-[28px] md:text-[34px] leading-tight">{next.service.name}</h2>
                <p class="text-man-or font-bold mt-1">{next.service.label}</p>
              </div>
              <div class="flex gap-4 md:gap-6" role="timer" aria-label={cd.label}>
                {#each cd.parts as part}
                  <div aria-hidden="true" class="flex flex-col">
                    <span class="font-slab text-[36px] md:text-[44px] font-bold tabular-nums leading-none">{#key part.v}<span class="man-tick">{part.v}</span>{/key}</span>
                    <span class="text-[13px] text-man-doux mt-1">{part.l}</span>
                  </div>
                {/each}
              </div>
            {/if}
            <p class="text-man-doux">La diffusion apparaîtra ici automatiquement, sans recharger la page.</p>
            <div class="flex flex-wrap gap-3 mt-1">
              <a href="/mediatheque#sermons" class="btn-ghost">Revoir les messages</a>
              <a href="/priere" class="btn-ghost">Demander la prière</a>
            </div>
          </div>
          <img src="/images/design/sanctuaire-800.jpg" alt="" class="hidden md:block w-full h-full object-cover opacity-70" loading="lazy" />
        </section>
      {/if}

      {#if data.upcoming.length}
        <h2 use:reveal class="font-slab font-bold text-[30px] md:text-[36px] leading-tight text-man-nuit mb-5">Diffusions programmées</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-14">
          {#each data.upcoming as s (s.id)}
            <div class="rounded-[22px] bg-[#F3F6FA] p-5">
              <div class="text-sm font-bold text-man-marine">{[TYPE[s.type], formatDate(s.scheduled_at, true)].filter(Boolean).join(", ")}</div>
              <div class="font-slab font-bold text-[20px] leading-tight text-man-nuit mt-1">{s.title}</div>
              {#if s.description}<div class="text-[15px] text-[#4A6285] mt-1 whitespace-pre-line line-clamp-3">{s.description}</div>{/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if data.replays.length}
        <h2 use:reveal class="font-slab font-bold text-[30px] md:text-[36px] leading-tight text-man-nuit mb-5">Rediffusions</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {#each data.replays as s (s.id)}
            <div>
              <div class="rounded-[22px] overflow-hidden"><VideoEmbed url={s.recording_url} title={s.title} /></div>
              <div class="mt-3 font-slab font-bold text-[19px] text-man-nuit">{s.title}</div>
              <div class="text-sm text-[#4A6285]">{formatDate(s.ended_at)}</div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>
