<script>
  // Tous les événements à venir, avec inscription quand l'événement l'exige.
  import { onMount, tick } from "svelte";
  import api from "../../utils/api";
  import { cdn } from "../../utils/cdn";
  import { reveal } from "../../utils/motion";
  import PageHero from "../../components/pages/PageHero.svelte";
  import RegisterModal from "../../components/events/RegisterModal.svelte";
  import { dayNum, monthShort, when, registrationLabel, FALLBACK_IMAGE } from "../../utils/events";

  let events = null;
  let failed = false;
  let open = null;

  const load = async () => {
    failed = false;
    try {
      events = (await api.get("/events")).data;
    } catch {
      failed = true;
    }
  };

  onMount(async () => {
    await load();
    // Lien direct vers un événement : /evenements#<id>
    const id = location.hash.slice(1);
    if (id) {
      await tick();
      document.getElementById(`ev-${id}`)?.scrollIntoView({ block: "start" });
    }
  });
</script>

<svelte:head>
  <title>Événements - M.A.N. - Maison D'Adoration Pour les Nations</title>
  <meta name="description" content="Les prochains événements de la Maison d'Adoration pour les Nations à Lubumbashi : dates, lieux et inscriptions." />
</svelte:head>

<PageHero title="Événements" subtitle="Les prochains rendez-vous de la Maison. Certains demandent une inscription : réservez votre place en une minute." image="/images/design/adoration.jpg" />

<div class="on-light bg-white py-12 md:py-16 min-h-[50vh]">
  <div class="max-w-[1040px] mx-auto px-5 md:px-10">
    {#if failed}
      <div class="rounded-[22px] bg-[#F3F6FA] p-6 flex flex-col items-start gap-3">
        <p class="text-man-nuit">Les événements n'ont pas pu être chargés. Vérifiez votre connexion internet.</p>
        <button type="button" class="btn-line" on:click={load}>Réessayer</button>
      </div>
    {:else if events === null}
      <div class="grid gap-5" aria-busy="true" aria-label="Chargement des événements">
        {#each [0, 1] as _}<div class="h-[220px] rounded-[26px] bg-[#EEF2F8] animate-pulse"></div>{/each}
      </div>
    {:else if events.length === 0}
      <div class="rounded-[26px] bg-[#F3F6FA] p-8 md:p-12 flex flex-col items-start gap-3">
        <h2 class="font-slab font-bold text-[28px] text-man-nuit">Aucun événement annoncé pour l'instant</h2>
        <p class="text-[17px] text-[#2B3F5C]">Les cultes ont lieu chaque mercredi, vendredi et dimanche. Les prochains événements seront annoncés ici.</p>
        <a href="/#programme" class="btn-or mt-2">Voir le programme de la semaine</a>
      </div>
    {:else}
      <ul class="grid gap-6">
        {#each events as ev (ev.id)}
          <li id="ev-{ev.id}" class="scroll-mt-28 rounded-[26px] overflow-hidden bg-[#F3F6FA] grid md:grid-cols-[300px_1fr]">
            <div class="relative h-[190px] md:h-auto">
              <img src={cdn(ev.imageUrl || FALLBACK_IMAGE, 700)} alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
              <div class="absolute left-4 top-4 w-[66px] rounded-2xl bg-man-or text-man-nuit text-center py-2" aria-hidden="true">
                <div class="font-slab font-bold text-[28px] leading-none">{dayNum(ev.startsAt)}</div>
                <div class="font-extrabold text-[13px] mt-0.5">{monthShort(ev.startsAt)}</div>
              </div>
            </div>
            <div class="p-6 md:p-8 flex flex-col gap-3">
              <h2 use:reveal class="font-slab font-bold text-[26px] md:text-[32px] leading-tight text-man-nuit">{ev.title}</h2>
              <p class="text-[17px] text-[#2B3F5C] first-letter:uppercase">{when(ev)}{ev.location ? `, ${ev.location}` : ""}</p>
              {#if ev.description}<p class="text-[#2B3F5C] leading-relaxed whitespace-pre-line">{ev.description}</p>{/if}
              <div class="mt-2 flex flex-wrap items-center gap-x-5 gap-y-3">
                {#if ev.registrationOpen}
                  <button type="button" class="btn-or" on:click={() => (open = ev)}>S'inscrire</button>
                {/if}
                <span class="inline-flex items-center gap-2 font-bold text-[15px] text-man-marine"><span class="w-2 h-2 rounded-full {ev.registrationMode === 'required' ? 'bg-man-or' : 'bg-man-ciel'}" aria-hidden="true"></span>{registrationLabel(ev)}</span>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</div>

<RegisterModal event={open} on:close={(e) => { open = null; if (e.detail.registered) load(); }} />
