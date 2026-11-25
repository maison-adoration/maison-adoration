<script>
  // Régie du direct : modération de la discussion, message de l'équipe,
  // appels à l'action (un seul affiché à la fois), fin avec archivage.
  import { onMount, onDestroy, createEventDispatcher, tick } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import Modal from "../../utils/Modal.svelte";
  import FormAlert from "../../auth/FormAlert.svelte";
  import VideoEmbed from "../../media/VideoEmbed.svelte";

  export let streamId;
  export let seriesOptions = [];
  const dispatch = createEventDispatcher();
  const input = "man-input w-full h-[48px] rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 text-man-nuit focus:border-man-marine focus:outline-none";

  let room = null;
  let notice = { text: "", kind: "success" };
  let timer;
  let listEl;
  let hostMsg = "";
  let events = [];
  let creating = null;
  let ending = null;
  let busy = false;

  const KINDS = [
    { v: "give", t: "Donner", d: "Ouvre la section des dons du site.", title: "Soutenez l'œuvre de Dieu", button: "Donner" },
    { v: "event", t: "Événement", d: "Inscription à un événement annoncé.", title: "", button: "S'inscrire" },
    { v: "salvation", t: "« J'ai donné ma vie à Christ »", d: "Les personnes laissent leur nom ; l'équipe d'accueil les rappelle.", title: "J'ai donné ma vie à Christ", button: "Je réponds" },
    { v: "link", t: "Lien", d: "Un lien de votre choix (formulaire, page…).", title: "", button: "Ouvrir" },
  ];

  async function load() {
    try {
      const atEnd = !listEl || listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40;
      room = (await api.get(`/media/streams/${streamId}/room`)).data;
      if (atEnd) {
        await tick();
        listEl && (listEl.scrollTop = listEl.scrollHeight);
      }
    } catch (err) {
      notice = { text: errorMessage(err, "La régie n'a pas pu se mettre à jour."), kind: "error" };
    }
  }

  onMount(() => {
    load();
    timer = setInterval(() => !document.hidden && load(), 4000);
    api.get("/media/events-options").then((r) => (events = r.data)).catch(() => {});
  });
  onDestroy(() => clearInterval(timer));

  const say = (text, kind = "success") => (notice = { text, kind });

  async function toggleHidden(m) {
    try {
      await api.put(`/media/chat/${m.id}`, { isHidden: !m.isHidden });
      m.isHidden = !m.isHidden;
      room = room;
    } catch (err) {
      say(errorMessage(err), "error");
    }
  }

  async function sendHost() {
    if (!hostMsg.trim()) return;
    try {
      await api.post(`/media/streams/${streamId}/chat`, { body: hostMsg.trim() });
      hostMsg = "";
      load();
    } catch (err) {
      say(errorMessage(err), "error");
    }
  }

  async function toggleSetting(key) {
    try {
      await api.put(`/media/streams/${streamId}`, { [key]: !room.stream[key === "chatEnabled" ? "chat_enabled" : "prayer_enabled"] });
      load();
    } catch (err) {
      say(errorMessage(err), "error");
    }
  }

  const newMoment = (k) => (creating = { kind: k.v, title: k.title, body: "", buttonLabel: k.button, url: "", eventId: "", error: "" });
  $: if (creating && creating.kind === "event" && creating.eventId && !creating.title) {
    const ev = events.find((e) => e.id === creating.eventId);
    if (ev) creating.title = ev.title;
  }

  async function saveMoment(activate) {
    busy = true;
    try {
      const m = (await api.post(`/media/streams/${streamId}/moments`, {
        kind: creating.kind,
        title: creating.title.trim(),
        body: creating.body.trim(),
        buttonLabel: creating.buttonLabel.trim(),
        url: creating.url.trim() || null,
        eventId: creating.eventId || null,
      })).data;
      if (activate) await api.post(`/media/moments/${m.id}/activate`);
      creating = null;
      say(activate ? "Appel affiché aux spectateurs." : "Appel préparé.");
      load();
    } catch (err) {
      creating.error = errorMessage(err, "L'appel n'a pas pu être enregistré.");
    } finally {
      busy = false;
    }
  }

  async function momentAction(m, action) {
    try {
      if (action === "delete") await api.delete(`/media/moments/${m.id}`);
      else await api.post(`/media/moments/${m.id}/${action}`);
      load();
    } catch (err) {
      say(errorMessage(err), "error");
    }
  }

  const startEnd = () => (ending = { archive: Boolean(room.stream.stream_url), title: room.stream.title, preacher: "", seriesId: "", publish: true, error: "" });
  async function endLive() {
    busy = true;
    try {
      const r = (await api.post(`/media/streams/${streamId}/end`, {
        archive: ending.archive,
        title: ending.title.trim() || undefined,
        preacher: ending.preacher.trim() || undefined,
        seriesId: ending.seriesId || null,
        publish: ending.publish,
      })).data;
      ending = null;
      dispatch("ended", { archived: r.archivedSermon });
    } catch (err) {
      ending.error = errorMessage(err, "Le direct n'a pas pu être terminé.");
    } finally {
      busy = false;
    }
  }

  const time = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  $: s = room && room.stream;
  $: active = room && room.moments.find((m) => m.isActive);
</script>

<button type="button" class="font-bold text-man-marine hover:underline mb-4 min-h-[44px]" on:click={() => dispatch("close")}>← Tous les directs</button>
<div class="mb-4"><FormAlert light message={notice.text} kind={notice.kind} /></div>

{#if !room}
  <div class="h-[420px] rounded-[22px] bg-white animate-pulse" aria-busy="true" aria-label="Chargement de la régie"></div>
{:else}
  <div class="rounded-[22px] bg-man-nuit text-white p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-4">
    <div class="flex-1 min-w-0">
      <p class="inline-flex items-center gap-2 font-extrabold {s.is_live ? 'text-man-lumiere' : 'text-man-doux'}">
        {#if s.is_live}<span class="man-live w-2.5 h-2.5 rounded-full bg-man-lumiere" aria-hidden="true"></span>En direct{:else if s.ended_at}Terminé{:else}Pas encore lancé{/if}
      </p>
      <h2 class="font-slab font-bold text-[26px] leading-tight">{s.title}</h2>
    </div>
    <dl class="flex gap-6">
      <div><dt class="text-sm text-man-doux">Messages</dt><dd class="font-slab font-bold text-[26px] tabular-nums">{room.messages.length}</dd></div>
      <div><dt class="text-sm text-man-doux">Demandes de prière</dt><dd class="font-slab font-bold text-[26px] tabular-nums">{room.prayerCount}</dd></div>
    </dl>
    {#if s.is_live}
      <button type="button" class="btn-or !bg-[#B3261E] !text-white" on:click={startEnd}>Terminer le direct</button>
    {/if}
  </div>

  <div class="mt-5 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5 items-start">
    <section class="rounded-[22px] bg-white overflow-hidden flex flex-col" aria-labelledby="rg-chat">
      <div class="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3 border-b border-[#E1E8F1]">
        <h3 id="rg-chat" class="font-slab font-bold text-[22px] text-man-nuit">Discussion</h3>
        <div class="flex flex-wrap gap-4">
          <label class="flex items-center gap-2 min-h-[44px] cursor-pointer text-[15px] font-bold text-man-nuit">
            <input type="checkbox" checked={s.chat_enabled} on:change={() => toggleSetting("chatEnabled")} class="w-5 h-5 accent-[#173E6F]" />Discussion ouverte
          </label>
          <label class="flex items-center gap-2 min-h-[44px] cursor-pointer text-[15px] font-bold text-man-nuit">
            <input type="checkbox" checked={s.prayer_enabled} on:change={() => toggleSetting("prayerEnabled")} class="w-5 h-5 accent-[#173E6F]" />Bouton prière
          </label>
        </div>
      </div>
      <ul bind:this={listEl} class="h-[420px] overflow-y-auto px-5 py-3 grid content-start gap-2" aria-label="Messages des spectateurs">
        {#each room.messages as m (m.id)}
          <li class="flex items-start gap-3 rounded-xl px-3 py-2 {m.isHidden ? 'bg-[#FDECEA]' : m.isHost ? 'bg-[#EAF3FB]' : ''}">
            <div class="flex-1 min-w-0">
              <span class="font-bold text-man-nuit">{m.name}{m.isHost ? " · Équipe" : ""}</span>
              <span class="text-[13px] text-[#4A6285] ml-1">{time(m.createdAt)}</span>
              <p class="text-[#2B3F5C] break-words {m.isHidden ? 'line-through' : ''}">{m.body}</p>
            </div>
            <button type="button" class="shrink-0 min-h-[36px] px-2 text-[13px] font-bold {m.isHidden ? 'text-man-marine' : 'text-[#B3261E]'} hover:underline" on:click={() => toggleHidden(m)}
              aria-label="{m.isHidden ? 'Rétablir' : 'Masquer'} le message de {m.name}">{m.isHidden ? "Rétablir" : "Masquer"}</button>
          </li>
        {:else}
          <li class="text-[#4A6285] py-8 text-center">Aucun message pour l'instant.</li>
        {/each}
      </ul>
      <form class="border-t border-[#E1E8F1] p-4 flex gap-2" on:submit|preventDefault={sendHost}>
        <label class="sr-only" for="rg-host">Message de l'équipe</label>
        <input id="rg-host" bind:value={hostMsg} maxlength="500" placeholder="Message de l'équipe (mis en avant)" class={input} />
        <button type="submit" class="btn-or !min-h-[48px] shrink-0" disabled={!hostMsg.trim()}>Envoyer</button>
      </form>
    </section>

    <section class="rounded-[22px] bg-white p-5 md:p-6" aria-labelledby="rg-calls">
      <h3 id="rg-calls" class="font-slab font-bold text-[22px] text-man-nuit">Appels à l'action</h3>
      <p class="text-[15px] text-[#4A6285] mt-1">Un seul appel est affiché à la fois, sous la vidéo.</p>

      {#if active}
        <div class="mt-4 rounded-2xl bg-man-or text-man-nuit p-4">
          <p class="text-sm font-extrabold">Affiché maintenant</p>
          <p class="font-slab font-bold text-[20px] leading-tight">{active.title}</p>
          {#if active.kind === "salvation"}<p class="mt-1 font-bold">{active.responses || 0} réponse{active.responses > 1 ? "s" : ""}</p>{/if}
          <button type="button" class="mt-3 inline-flex items-center min-h-[44px] px-5 rounded-full bg-man-nuit text-white font-extrabold" on:click={() => momentAction(active, "deactivate")}>Retirer de l'écran</button>
        </div>
      {/if}

      {#if room.moments.filter((m) => !m.isActive).length}
        <ul class="mt-4 grid gap-2">
          {#each room.moments.filter((m) => !m.isActive) as m (m.id)}
            <li class="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E1E8F1] p-3">
              <span class="flex-1 min-w-0 font-bold text-man-nuit">{m.title}{#if m.kind === "salvation" && m.responses} <span class="font-normal text-[#4A6285]">({m.responses})</span>{/if}</span>
              <button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => momentAction(m, "activate")}>Afficher</button>
              <button type="button" class="min-h-[40px] px-2 text-[14px] font-bold text-[#B3261E] hover:underline" on:click={() => momentAction(m, "delete")} aria-label="Supprimer l'appel {m.title}">Supprimer</button>
            </li>
          {/each}
        </ul>
      {/if}

      <p class="mt-5 text-sm font-bold text-man-nuit">Préparer un appel</p>
      <div class="mt-2 grid sm:grid-cols-2 gap-2">
        {#each KINDS as k}
          <button type="button" class="text-left rounded-2xl border-[1.5px] border-[#E1E8F1] p-3 hover:border-man-marine transition-colors duration-150" on:click={() => newMoment(k)}>
            <span class="block font-bold text-man-nuit">{k.t}</span>
            <span class="block text-[14px] text-[#4A6285]">{k.d}</span>
          </button>
        {/each}
      </div>
    </section>
  </div>

  {#if s.stream_url}
    <details class="mt-5 rounded-[22px] bg-white p-5">
      <summary class="font-bold text-man-nuit cursor-pointer min-h-[44px] flex items-center">Aperçu de la diffusion</summary>
      <div class="mt-3 max-w-[720px]"><VideoEmbed url={s.stream_url} title={s.title} /></div>
    </details>
  {/if}
{/if}

<Modal show={Boolean(creating)} title="Nouvel appel" on:modalClose={() => (creating = null)}>
  {#if creating}
    <form class="grid gap-4" on:submit|preventDefault={() => saveMoment(true)} novalidate>
      <FormAlert light message={creating.error} />
      {#if creating.kind === "event"}
        <div class="flex flex-col gap-2">
          <label for="mo-ev" class="text-sm font-bold text-man-nuit">Événement</label>
          <select id="mo-ev" bind:value={creating.eventId} class={input}>
            <option value="">Choisir…</option>
            {#each events as e}<option value={e.id}>{e.title}</option>{/each}
          </select>
        </div>
      {/if}
      <div class="flex flex-col gap-2">
        <label for="mo-t" class="text-sm font-bold text-man-nuit">Titre affiché</label>
        <input id="mo-t" bind:value={creating.title} maxlength="120" class={input} />
      </div>
      <div class="flex flex-col gap-2">
        <label for="mo-b" class="text-sm font-bold text-man-nuit">Texte <span class="font-normal text-[#4A6285]">(facultatif)</span></label>
        <input id="mo-b" bind:value={creating.body} maxlength="500" class={input} />
      </div>
      {#if creating.kind === "link"}
        <div class="flex flex-col gap-2">
          <label for="mo-u" class="text-sm font-bold text-man-nuit">Lien</label>
          <input id="mo-u" type="url" bind:value={creating.url} placeholder="https://…" class={input} />
        </div>
      {/if}
      <div class="flex flex-col gap-2">
        <label for="mo-btn" class="text-sm font-bold text-man-nuit">Texte du bouton</label>
        <input id="mo-btn" bind:value={creating.buttonLabel} maxlength="40" class={input} />
      </div>
      <button type="submit" class="btn-or w-full" disabled={busy}>Afficher maintenant</button>
      <button type="button" class="btn-line w-full" disabled={busy} on:click={() => saveMoment(false)}>Préparer sans afficher</button>
    </form>
  {/if}
</Modal>

<Modal show={Boolean(ending)} title="Terminer le direct ?" on:modalClose={() => (ending = null)}>
  {#if ending}
    <div class="grid gap-4">
      <FormAlert light message={ending.error} />
      <p class="text-[#2B3F5C]">La discussion se ferme et les appels disparaissent de l'écran des spectateurs.</p>
      {#if s.stream_url}
        <label class="flex items-start gap-3 rounded-2xl border-[1.5px] p-4 cursor-pointer {ending.archive ? 'border-man-marine bg-[#EAF3FB]' : 'border-[#E1E8F1]'}">
          <input type="checkbox" bind:checked={ending.archive} class="mt-1 w-5 h-5 accent-[#173E6F]" />
          <span><span class="block font-bold text-man-nuit">Archiver en message</span><span class="block text-[15px] text-[#4A6285]">La vidéo YouTube du direct rejoint la bibliothèque des messages.</span></span>
        </label>
        {#if ending.archive}
          <div class="flex flex-col gap-2">
            <label for="en-t" class="text-sm font-bold text-man-nuit">Titre du message</label>
            <input id="en-t" bind:value={ending.title} maxlength="300" class={input} />
          </div>
          <div class="flex flex-col gap-2">
            <label for="en-p" class="text-sm font-bold text-man-nuit">Prédicateur <span class="font-normal text-[#4A6285]">(facultatif)</span></label>
            <input id="en-p" bind:value={ending.preacher} maxlength="200" placeholder="Prophète Israel Kayembe" class={input} />
          </div>
          {#if seriesOptions.length > 1}
            <div class="flex flex-col gap-2">
              <label for="en-s" class="text-sm font-bold text-man-nuit">Série <span class="font-normal text-[#4A6285]">(facultatif)</span></label>
              <select id="en-s" bind:value={ending.seriesId} class={input}>
                {#each seriesOptions as o}<option value={o.value}>{o.label}</option>{/each}
              </select>
            </div>
          {/if}
          <label class="flex items-center gap-3 min-h-[44px] cursor-pointer">
            <input type="checkbox" bind:checked={ending.publish} class="w-5 h-5 accent-[#173E6F]" />
            <span class="text-man-nuit">Publier tout de suite <span class="text-[#4A6285]">(sinon : brouillon à compléter)</span></span>
          </label>
        {/if}
      {/if}
      <button type="button" class="btn-or w-full !bg-[#B3261E] !text-white" disabled={busy} aria-busy={busy} on:click={endLive}>Terminer le direct</button>
    </div>
  {/if}
</Modal>
