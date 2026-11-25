<script>
  // Annonce du prochain événement mis en avant (vitrine de l'accueil).
  // Rien ne s'affiche s'il n'y en a pas.
  import { onMount } from "svelte";
  import api from "../../utils/api";
  import { cdn } from "../../utils/cdn";
  import { reveal } from "../../utils/motion";
  import { dayNum, monthShort, when, registrationLabel, FALLBACK_IMAGE } from "../../utils/events";
  import RegisterModal from "../events/RegisterModal.svelte";

  let ev = null;
  let open = null;
  let others = 0;

  const load = async () => {
    try {
      const [featured, all] = await Promise.all([api.get("/events", { params: { featured: 1 } }), api.get("/events")]);
      ev = featured.data[0] || all.data[0] || null;
      others = Math.max(0, all.data.length - 1);
    } catch {
      ev = null;
    }
  };
  onMount(load);
</script>

{#if ev}
  <section class="relative overflow-hidden bg-man-nuit2 text-white" aria-labelledby="annonce-titre">
    <div class="grid md:grid-cols-[1.15fr_1fr] min-h-[420px]">
      <div class="relative md:order-2 h-[220px] md:h-auto">
        <img src={cdn(ev.imageUrl || FALLBACK_IMAGE, 900)} alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover" />
        <span aria-hidden="true" class="absolute inset-0 md:hidden" style="background: linear-gradient(180deg, rgba(14,34,64,0) 40%, #0E2240 100%)"></span>
        <span aria-hidden="true" class="absolute inset-0 hidden md:block" style="background: linear-gradient(90deg, #0E2240 0%, rgba(14,34,64,.35) 45%, rgba(14,34,64,0) 100%)"></span>
      </div>
      <div class="relative md:order-1 px-5 md:px-10 lg:pl-[max(2.5rem,calc((100vw-1240px)/2))] py-10 md:py-16 flex flex-col justify-center">
        <div class="flex items-start gap-5">
          <div class="shrink-0 w-[76px] rounded-2xl bg-man-or text-man-nuit text-center py-2.5" aria-hidden="true">
            <div class="font-slab font-bold text-[34px] leading-none">{dayNum(ev.startsAt)}</div>
            <div class="font-extrabold text-[14px] mt-1">{monthShort(ev.startsAt)}</div>
          </div>
          <div class="min-w-0">
            <p class="text-man-doux font-bold">Prochain événement</p>
            <h2 id="annonce-titre" use:reveal class="font-slab font-bold text-[32px] md:text-[clamp(36px,4vw,54px)] leading-[1.02] mt-1">{ev.title}</h2>
          </div>
        </div>
        <p class="mt-5 text-[17px] text-man-texte first-letter:uppercase">{when(ev)}{ev.location ? `, ${ev.location}` : ""}</p>
        {#if ev.description}<p class="mt-3 text-man-doux leading-relaxed max-w-[520px] line-clamp-3">{ev.description}</p>{/if}
        <div class="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
          {#if ev.registrationOpen}
            <button type="button" class="btn-or" on:click={() => (open = ev)}>S'inscrire</button>
          {/if}
          <span class="inline-flex items-center gap-2 font-bold text-[15px] {ev.registrationMode === 'required' ? 'text-man-or' : 'text-man-texte'}"><span class="w-2 h-2 rounded-full {ev.registrationMode === 'required' ? 'bg-man-or' : 'bg-man-ciel'}" aria-hidden="true"></span>{registrationLabel(ev)}</span>
          <a href="/evenements" class="font-bold text-man-ciel hover:underline ml-1">{others ? `Tous les événements (${others + 1})` : "Voir l'événement"}</a>
        </div>
      </div>
    </div>
  </section>
  <RegisterModal event={open} on:close={(e) => { open = null; if (e.detail.registered) load(); }} />
{/if}
