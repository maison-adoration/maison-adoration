<script>
  // Vue d'ensemble de la gestion : ce qui attend une action, et les dons du mois.
  import { createEventDispatcher, onMount } from "svelte";
  import api from "../../utils/api";
  import { when } from "../../utils/events";

  const dispatch = createEventDispatcher();
  const DAY = { mer: "mercredi", ven: "vendredi", dim: "dimanche" };

  let visits = null;
  let kids = null;
  let pay = null;
  let nextEvent = undefined;
  let failed = false;

  const monthStart = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };
  const monthName = new Date().toLocaleDateString("fr-FR", { month: "long" });
  const money = (t) => `${Number(t.total).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${t.currency}`;

  let prayerNew = 0;
  let decisionsNew = 0;
  onMount(async () => {
    try {
      const [v, k, d, ev] = await Promise.all([
        api.get("/visits", { params: { status: "new" } }),
        api.get("/kids-registrations", { params: { status: "new" } }),
        api.get("/payments", { params: { purpose: "donation", from: monthStart() } }),
        api.get("/events/admin/all"),
      ]);
      nextEvent = ev.data.find((e) => new Date(e.endsAt || e.startsAt) >= new Date()) || null;
      visits = v.data;
      kids = k.data;
      pay = d.data;
      dispatch("counts", { visits: visits.length, kids: kids.length });
      // Prière : nouvelles demandes et décisions à suivre (badge de l'onglet).
      Promise.all([api.get("/prayer-requests", { params: { status: "new" } }), api.get("/faith-decisions")])
        .then(([p, f]) => {
          prayerNew = p.data.items.length;
          decisionsNew = f.data.filter((x) => x.status === "new").length;
          dispatch("counts", { visits: visits.length, kids: kids.length, prayer: prayerNew + decisionsNew });
        })
        .catch(() => {});
    } catch {
      failed = true;
    }
  });
</script>

{#if failed}
  <div class="rounded-[22px] bg-white p-6">
    <p class="text-man-nuit">La vue d'ensemble n'a pas pu être chargée. Vérifiez la connexion, puis rechargez la page.</p>
  </div>
{:else if visits === null}
  <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-5" aria-busy="true" aria-label="Chargement">
    {#each [0, 1, 2, 3] as _}<div class="h-[220px] rounded-[22px] bg-white animate-pulse"></div>{/each}
  </div>
{:else}
  <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-5">
    <section class="rounded-[22px] bg-white p-6 flex flex-col" aria-labelledby="ov-event">
      <h2 id="ov-event" class="font-bold text-man-marine">Prochain événement</h2>
      {#if nextEvent}
        <p class="font-slab font-bold text-[24px] leading-tight text-man-nuit mt-2">{nextEvent.title}</p>
        <p class="text-[15px] text-[#2B3F5C] mt-1 first-letter:uppercase">{when(nextEvent)}</p>
        <p class="text-[15px] text-[#2B3F5C] mt-3">
          {#if nextEvent.registrationMode === "required"}
            <strong class="text-man-nuit">{nextEvent.seatsTaken}</strong> personne{nextEvent.seatsTaken > 1 ? "s" : ""} inscrite{nextEvent.seatsTaken > 1 ? "s" : ""}{nextEvent.capacity ? ` sur ${nextEvent.capacity}` : ""}
          {:else}Entrée libre{/if}
          {#if !nextEvent.isPublished}<span class="block text-[#7A5600] font-bold">Brouillon, pas encore publié</span>{/if}
        </p>
      {:else}
        <p class="text-[15px] text-[#2B3F5C] mt-2">Aucun événement à venir.</p>
      {/if}
      <button type="button" class="btn-line mt-auto self-start !min-h-[44px] pt-0" on:click={() => dispatch("go", "events")}>{nextEvent ? "Gérer les événements" : "Créer un événement"}</button>
    </section>

    <section class="rounded-[22px] bg-white p-6 flex flex-col" aria-labelledby="ov-visits">
      <h2 id="ov-visits" class="font-bold text-man-marine">Visiteurs à accueillir</h2>
      <p class="font-slab font-bold text-[44px] leading-none text-man-nuit mt-2">{visits.length}</p>
      <ul class="mt-4 grid gap-1 text-[15px] text-[#2B3F5C]">
        {#each visits.slice(0, 3) as v (v.id)}<li>{v.name}, {DAY[v.day]}</li>{/each}
      </ul>
      <button type="button" class="btn-line mt-auto self-start !min-h-[44px]" on:click={() => dispatch("go", "visits")}>Voir les visiteurs</button>
    </section>

    <section class="rounded-[22px] bg-white p-6 flex flex-col" aria-labelledby="ov-kids">
      <h2 id="ov-kids" class="font-bold text-man-marine">Nouvelles inscriptions Man Kids</h2>
      <p class="font-slab font-bold text-[44px] leading-none text-man-nuit mt-2">{kids.length}</p>
      <ul class="mt-4 grid gap-1 text-[15px] text-[#2B3F5C]">
        {#each kids.slice(0, 3) as k (k.id)}<li>{k.childName || k.child_name}, {k.childAge ?? k.child_age} ans</li>{/each}
      </ul>
      <button type="button" class="btn-line mt-auto self-start !min-h-[44px]" on:click={() => dispatch("go", "kids")}>Voir les inscriptions</button>
    </section>

    <section class="rounded-[22px] bg-man-nuit text-white p-6 flex flex-col" aria-labelledby="ov-dons">
      <h2 id="ov-dons" class="font-bold text-man-or">Dons reçus en {monthName}</h2>
      {#if pay.totals.length}
        {#each pay.totals as t}
          <p class="font-slab font-bold text-[40px] leading-none mt-2">{money(t)}</p>
          <p class="text-man-doux text-[15px] mt-1">{t.successes} don{t.successes > 1 ? "s" : ""} confirmé{t.successes > 1 ? "s" : ""}{t.pending ? `, ${t.pending} en attente` : ""}</p>
        {/each}
      {:else}
        <p class="font-slab font-bold text-[40px] leading-none mt-2">0</p>
        <p class="text-man-doux text-[15px] mt-1">Aucun don en ligne ce mois-ci.</p>
      {/if}
      <button type="button" class="btn-ghost mt-auto self-start !min-h-[44px] pt-0" on:click={() => dispatch("go", "payments")}>Voir les dons et paiements</button>
    </section>
  </div>
{/if}
