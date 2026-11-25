<script>
  // Salle du direct : appel à l'action du moment, discussion modérée,
  // demande de prière. Interrogée toutes les 4 s, seulement onglet visible.
  import { onMount, onDestroy, tick } from "svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";
  import Modal from "../utils/Modal.svelte";
  import Field from "../auth/Field.svelte";
  import FormAlert from "../auth/FormAlert.svelte";
  import PrayerForm from "./PrayerForm.svelte";

  export let stream; // direct en cours

  let room = null;
  let messages = [];
  let since = null;
  let timer;
  let listEl;
  let atBottom = true;
  let name = "";
  let body = "";
  let chatError = "";
  let sending = false;
  let prayerOpen = false;
  let decisionOpen = false;

  const NAME_KEY = "man_chat_name";

  async function load() {
    try {
      const r = (await api.get(`/media/public/live/${stream.id}/room`, { params: since ? { since } : {} })).data;
      const hidden = new Set(r.hidden || []);
      const known = new Set(messages.map((m) => m.id));
      messages = [...messages.filter((m) => !hidden.has(m.id)), ...r.messages.filter((m) => !known.has(m.id))].slice(-150);
      if (r.messages.length) since = r.messages[r.messages.length - 1].createdAt;
      room = r;
      if (atBottom) {
        await tick();
        listEl && (listEl.scrollTop = listEl.scrollHeight);
      }
    } catch {
      /* nouvel essai au prochain passage */
    }
  }

  onMount(() => {
    try { name = localStorage.getItem(NAME_KEY) || ""; } catch {}
    load();
    timer = setInterval(() => !document.hidden && load(), 4000);
  });
  onDestroy(() => clearInterval(timer));

  $: signedName = $config.currentUser && $config.currentUser.name;
  const onScroll = () => {
    atBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 40;
  };

  async function send() {
    chatError = "";
    const who = signedName || name.trim();
    if (who.length < 2) return (chatError = "Indiquez votre prénom pour écrire.");
    if (!body.trim()) return;
    sending = true;
    try {
      const m = (await api.post(`/media/public/live/${stream.id}/chat`, { name: who, body: body.trim() })).data;
      try { localStorage.setItem(NAME_KEY, who); } catch {}
      if (!messages.some((x) => x.id === m.id)) messages = [...messages, m];
      body = "";
      atBottom = true;
      await tick();
      listEl && (listEl.scrollTop = listEl.scrollHeight);
    } catch (e) {
      chatError = errorMessage(e, "Votre message n'est pas parti. Réessayez.");
    } finally {
      sending = false;
    }
  }

  const time = (iso) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // « J'ai donné ma vie à Christ »
  let dName = "";
  let dPhone = "";
  let dContact = true;
  let dErrors = {};
  let dAlert = "";
  let dBusy = false;
  let dDone = false;
  $: if (decisionOpen && $config.currentUser && !dName) {
    dName = $config.currentUser.name || "";
    dPhone = $config.currentUser.tel || "";
  }
  async function sendDecision() {
    dAlert = "";
    dErrors = {
      name: dName.trim().length >= 2 ? "" : "Saisissez votre nom.",
      phone: !dContact || /^\+?\d{9,15}$/.test(dPhone.replace(/[\s-]/g, "")) ? "" : "Saisissez un numéro avec l'indicatif pour être contacté.",
    };
    if (Object.values(dErrors).some(Boolean)) return;
    dBusy = true;
    try {
      await api.post(`/media/public/moments/${room.moment.id}/respond`, { name: dName.trim(), phone: dPhone.trim(), wantsContact: dContact });
      dDone = true;
    } catch (e) {
      dAlert = errorMessage(e, "Votre réponse n'a pas pu être envoyée. Réessayez.");
    } finally {
      dBusy = false;
    }
  }

  $: moment = room && room.moment;
  $: external = moment && moment.url && /^https?:/.test(moment.url);
</script>

{#if moment}
  <div class="man-pop mt-5 rounded-[22px] bg-man-or text-man-nuit p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4" role="region" aria-label="Appel du moment">
    <div class="flex-1 min-w-0">
      <p class="font-slab font-bold text-[22px] leading-tight">{moment.title}</p>
      {#if moment.body}<p class="mt-1 text-[16px]">{moment.body}</p>{/if}
    </div>
    {#if moment.kind === "salvation"}
      <button type="button" class="press inline-flex items-center justify-center min-h-[52px] px-6 rounded-full bg-man-nuit text-white font-extrabold" on:click={() => (decisionOpen = true)}>{moment.buttonLabel || "Je réponds"}</button>
    {:else if moment.url}
      <a href={moment.url} target={external ? "_blank" : undefined} rel={external ? "noopener" : undefined}
        class="press inline-flex items-center justify-center min-h-[52px] px-6 rounded-full bg-man-nuit text-white font-extrabold">{moment.buttonLabel || (moment.kind === "give" ? "Donner" : moment.kind === "event" ? "S'inscrire" : "Ouvrir")}</a>
    {/if}
  </div>
{/if}

<div class="mt-5 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
  {#if room && room.chatEnabled}
    <section class="rounded-[22px] border border-[#E1E8F1] flex flex-col overflow-hidden" aria-labelledby="t-chat">
      <h3 id="t-chat" class="px-5 pt-4 pb-3 font-bold text-man-nuit border-b border-[#E1E8F1]">Discussion</h3>
      <div bind:this={listEl} on:scroll={onScroll} class="h-[320px] overflow-y-auto px-5 py-3 flex flex-col gap-3" role="log" aria-live="off" aria-label="Messages de la discussion" tabindex="0">
        {#each messages as m (m.id)}
          <p class="text-[15px] leading-snug {m.isHost ? 'rounded-2xl bg-[#EAF3FB] px-3 py-2' : ''}">
            <span class="font-bold {m.isHost ? 'text-man-marine' : 'text-man-nuit'}">{m.name}{m.isHost ? " · Équipe" : ""}</span>
            <span class="text-[13px] text-[#4A6285] ml-1">{time(m.createdAt)}</span><br />
            <span class="text-[#2B3F5C] break-words">{m.body}</span>
          </p>
        {:else}
          <p class="text-[#4A6285] my-auto text-center">Soyez le premier à saluer l'assemblée.</p>
        {/each}
      </div>
      <form class="border-t border-[#E1E8F1] p-3 grid gap-2" on:submit|preventDefault={send}>
        {#if !signedName}
          <label class="sr-only" for="chat-name">Votre prénom</label>
          <input id="chat-name" bind:value={name} maxlength="60" autocomplete="given-name" placeholder="Votre prénom"
            class="man-input h-[44px] rounded-xl border-[1.5px] border-[#C9D6E8] bg-white px-3 text-man-nuit placeholder:text-[#8A9BB5]" />
        {/if}
        <div class="flex gap-2">
          <label class="sr-only" for="chat-body">Votre message</label>
          <input id="chat-body" bind:value={body} maxlength="300" autocomplete="off" placeholder="Écrire un message…"
            class="man-input flex-1 min-w-0 h-[44px] rounded-xl border-[1.5px] border-[#C9D6E8] bg-white px-3 text-man-nuit placeholder:text-[#8A9BB5]" />
          <button type="submit" class="btn-or !min-h-[44px] !px-5" disabled={sending || !body.trim()} aria-busy={sending}>Envoyer</button>
        </div>
        <p class="text-sm text-[#4A6285]">Les messages sont modérés par l'équipe média. Les liens ne sont pas acceptés.</p>
        {#if chatError}<p class="text-sm font-bold text-[#B3261E]" role="alert">{chatError}</p>{/if}
      </form>
    </section>
  {/if}

  {#if !room || room.prayerEnabled}
    <aside class="rounded-[22px] bg-man-nuit text-white p-5 flex flex-col gap-3 {room && !room.chatEnabled ? 'lg:col-span-2' : ''}">
      <p class="font-slab font-bold text-[22px] leading-tight">Besoin de prière ?</p>
      <p class="text-man-doux">L'équipe de prière reçoit votre demande pendant le culte.</p>
      <button type="button" class="btn-or" on:click={() => (prayerOpen = true)}>Demander la prière</button>
    </aside>
  {/if}
</div>

<Modal show={prayerOpen} title="Demander la prière" on:modalClose={() => (prayerOpen = false)}>
  <PrayerForm streamId={stream.id} />
</Modal>

<Modal show={decisionOpen} title={dDone ? "Bienvenue dans la famille" : moment && moment.kind === "salvation" ? moment.title : "J'ai donné ma vie à Christ"} on:modalClose={() => (decisionOpen = false)}>
  <div aria-live="polite">
    {#if dDone}
      <p class="text-[17px] text-man-nuit"><strong>{dName.trim().split(" ")[0]}</strong>, le ciel se réjouit avec vous (Luc 15 : 7).</p>
      <p class="mt-2 text-[#2B3F5C]">{dContact ? "Un membre de l'équipe vous contactera pour vous accompagner dans vos premiers pas." : "Nous prions pour vous. Vous êtes le bienvenu à chaque culte."}</p>
    {:else}
      <p class="text-[#2B3F5C] mb-4">Laissez-nous votre nom : l'équipe d'accueil vous accompagnera dans vos premiers pas avec Jésus.</p>
      <form class="grid gap-4" on:submit|preventDefault={sendDecision} novalidate>
        <FormAlert light message={dAlert} />
        <Field light label="Votre nom" name="dc-name" autocomplete="name" bind:value={dName} error={dErrors.name} required maxlength={120} />
        <label class="flex items-center gap-3 min-h-[44px] text-man-nuit cursor-pointer">
          <input type="checkbox" bind:checked={dContact} class="w-5 h-5 accent-[#173E6F]" />
          <span>Je souhaite être contacté</span>
        </label>
        {#if dContact}
          <Field light label="Téléphone" name="dc-phone" type="tel" autocomplete="tel" inputmode="tel" bind:value={dPhone} error={dErrors.phone} required maxlength={20} />
        {/if}
        <button type="submit" class="btn-or w-full" disabled={dBusy} aria-busy={dBusy}>{dBusy ? "Envoi…" : "Envoyer"}</button>
      </form>
    {/if}
  </div>
</Modal>
