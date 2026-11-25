<script>
  // Équipement et outils de l'équipe média : services branchés au site
  // (sans aucun secret) et matériel recommandé pour une diffusion de qualité.
  import { onMount } from "svelte";
  import api, { errorMessage } from "../../../utils/api";
  import { PODCAST_FEED } from "../../../utils/media";

  let status = null;
  let failed = "";
  let copied = "";
  let checked = {};
  const KEY = "man_media_checklist";

  onMount(async () => {
    try { checked = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch {}
    try {
      status = (await api.get("/media/tools-status")).data;
    } catch (err) {
      failed = errorMessage(err, "L'état des services n'a pas pu être lu.");
    }
  });
  const tick = (id) => {
    checked = { ...checked, [id]: !checked[id] };
    try { localStorage.setItem(KEY, JSON.stringify(checked)); } catch {}
  };

  $: feed = (status && status.podcastUrl) || PODCAST_FEED;
  $: services = status
    ? [
        { ok: status.youtubeApiKey, t: "Clé YouTube", d: status.youtubeApiKey ? "L'import récupère titre, description, date et durée." : "Sans clé, l'import récupère seulement le titre et la miniature.", ask: "Créer une clé « YouTube Data API v3 » (gratuite) dans Google Cloud, puis la donner à l'administrateur du système (réglage YOUTUBE_API_KEY)." },
        { ok: status.storage, t: "Stockage des fichiers", d: status.storage ? "Photos, audio et PDF sont hébergés." : "Les envois de photos, audio et PDF sont désactivés.", ask: "L'administrateur du système doit renseigner le compte Cloudinary." },
        { ok: status.apiPublicUrl, t: "Adresse publique du serveur", d: status.apiPublicUrl ? "Liens de partage WhatsApp et flux du podcast prêts." : "Le flux du podcast et les aperçus de partage utilisent une adresse provisoire.", ask: "L'administrateur du système doit renseigner API_PUBLIC_URL." },
        { ok: status.push, t: "Notifications", d: status.push ? "Les abonnés sont prévenus des nouvelles publications." : "Pas de notifications sur les appareils.", ask: "Réglage VAPID à faire par l'administrateur du système." },
      ]
    : [];

  const GEAR = [
    { g: "Image", items: [
      { id: "cam", t: "Caméra avec sortie HDMI « propre »", d: "Camescope ou hybride capable de filmer 2 h sans s'arrêter, sur trépied stable." },
      { id: "cam2", t: "Deuxième caméra (plan large)", d: "Facultatif : alterner chaire et assemblée rend le direct plus vivant." },
      { id: "mix", t: "Mélangeur vidéo HDMI ou carte d'acquisition", d: "Relie les caméras à l'ordinateur (type ATEM Mini, ou boîtier HDMI vers USB)." },
      { id: "light", t: "Deux projecteurs LED sur la chaire", d: "Une image nette demande de la lumière sur le visage du prédicateur." },
    ] },
    { g: "Son", items: [
      { id: "aux", t: "Départ son de la console vers l'ordinateur", d: "Par une interface audio USB. Le son ne doit jamais venir du micro de la caméra." },
      { id: "lav", t: "Micro-cravate sans fil pour le prédicateur", d: "Voix claire pour le direct et pour l'audio des messages (podcast)." },
      { id: "rec", t: "Enregistrement audio de chaque culte", d: "Exporter en MP3 (128 kbit/s), puis l'ajouter au message : écoute et téléchargement légers." },
    ] },
    { g: "Diffusion", items: [
      { id: "pc", t: "Ordinateur dédié avec OBS Studio", d: "Processeur i5 / Ryzen 5 récent, 16 Go de mémoire. OBS est gratuit." },
      { id: "net", t: "Internet : 10 Mbit/s en envoi pour la HD", d: "5 Mbit/s suffisent pour du 720p. Tester le débit avant chaque culte." },
      { id: "net2", t: "Connexion de secours (box 4G)", d: "Bascule rapide si la connexion principale coupe." },
      { id: "ups", t: "Onduleur (UPS)", d: "Ordinateur, mélangeur et box restent allumés pendant une coupure de courant." },
    ] },
    { g: "Compte YouTube", items: [
      { id: "yt", t: "Chaîne MAN TV vérifiée, direct activé", d: "La première activation du direct prend 24 heures." },
      { id: "key", t: "Clé de diffusion connue de deux personnes", d: "Le culte part même si l'opérateur habituel est absent." },
    ] },
  ];
  $: total = GEAR.reduce((n, g) => n + g.items.length, 0);
  $: done = GEAR.reduce((n, g) => n + g.items.filter((i) => checked[i.id]).length, 0);

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feed);
      copied = "Lien copié";
    } catch {
      copied = "Sélectionnez le lien pour le copier";
    }
  };
</script>

<div class="grid gap-5">
  <section class="rounded-[22px] bg-white p-6 md:p-8" aria-labelledby="tl-services">
    <h2 id="tl-services" class="font-slab font-bold text-[24px] text-man-nuit">Services du site</h2>
    <p class="mt-1 text-[#4A6285]">Les vidéos restent sur YouTube : le site n'en stocke aucune, donc pas de frais d'hébergement vidéo.</p>
    {#if failed}<p class="mt-4 font-bold text-[#B3261E]" role="alert">{failed}</p>{/if}
    {#if !status && !failed}
      <div class="mt-4 h-[160px] rounded-2xl bg-[#EEF2F8] animate-pulse" aria-busy="true" aria-label="Chargement"></div>
    {:else if status}
      <ul class="mt-4 grid md:grid-cols-2 gap-3">
        {#each services as s}
          <li class="rounded-2xl border-[1.5px] p-4 {s.ok ? 'border-[#CDEBDB]' : 'border-[#F5D9A8] bg-[#FFFAEE]'}">
            <p class="flex items-center gap-2 font-bold text-man-nuit">
              <span class="rounded-full px-2.5 py-0.5 text-[13px] {s.ok ? 'bg-[#E7F6EE] text-[#1E7A4C]' : 'bg-[#FFF4D6] text-[#7A5600]'}">{s.ok ? "Actif" : "À demander"}</span>{s.t}
            </p>
            <p class="mt-1 text-[15px] text-[#2B3F5C]">{s.d}</p>
            {#if !s.ok}<p class="mt-2 text-[15px] text-[#7A5600]"><strong>Demande :</strong> {s.ask}</p>{/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="rounded-[22px] bg-white p-6 md:p-8" aria-labelledby="tl-podcast">
    <h2 id="tl-podcast" class="font-slab font-bold text-[24px] text-man-nuit">Podcast sur Apple et Spotify</h2>
    <p class="mt-1 text-[#2B3F5C] max-w-[68ch]">Le flux contient les épisodes publiés et l'audio des messages. Soumettez-le <strong>une seule fois</strong> : les nouveaux épisodes apparaissent ensuite tout seuls.</p>
    <div class="mt-4 flex flex-col sm:flex-row gap-2">
      <label class="sr-only" for="tl-feed">Lien du flux du podcast</label>
      <input id="tl-feed" readonly value={feed} class="man-input w-full h-[48px] rounded-2xl bg-[#F3F6FA] border-[1.5px] border-[#E1E8F1] px-4 text-man-nuit" on:focus={(e) => e.currentTarget.select()} />
      <button type="button" class="btn-line !min-h-[48px] shrink-0" on:click={copyFeed}>Copier</button>
    </div>
    <p class="mt-1 text-sm text-[#1E7A4C] font-bold min-h-[1.25rem]" role="status" aria-live="polite">{copied}</p>
    <ol class="mt-3 grid gap-2 text-[15px] text-[#2B3F5C] list-decimal pl-5">
      <li>Apple Podcasts : sur <a class="font-bold text-man-marine underline" href="https://podcastsconnect.apple.com" target="_blank" rel="noopener">Podcasts Connect</a>, « Ajouter une émission », puis « Ajouter un flux RSS ».</li>
      <li>Spotify : sur <a class="font-bold text-man-marine underline" href="https://creators.spotify.com" target="_blank" rel="noopener">Spotify for Creators</a>, « J'ai déjà un podcast », puis coller le lien.</li>
      <li>La boîte maisondadoration@gmail.com reçoit le code de confirmation.</li>
    </ol>
    <p class="mt-3 text-sm text-[#4A6285]">L'image du podcast (3000 × 3000 px) est servie par le site : /podcast-cover.jpg.</p>
  </section>

  <section class="rounded-[22px] bg-white p-6 md:p-8" aria-labelledby="tl-gear">
    <div class="flex flex-wrap items-baseline justify-between gap-3">
      <h2 id="tl-gear" class="font-slab font-bold text-[24px] text-man-nuit">Matériel recommandé</h2>
      <p class="font-bold text-man-marine" aria-live="polite">{done} / {total} en place</p>
    </div>
    <p class="mt-1 text-[#4A6285]">Cochez ce que l'équipe possède déjà ; le reste est la liste à présenter aux responsables.</p>
    <div class="mt-4 grid lg:grid-cols-2 gap-5">
      {#each GEAR as group}
        <fieldset class="rounded-2xl border border-[#E1E8F1] p-4">
          <legend class="px-1 font-bold text-man-nuit">{group.g}</legend>
          <div class="grid gap-1">
            {#each group.items as it}
              <label class="flex items-start gap-3 py-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(checked[it.id])} on:change={() => tick(it.id)} class="mt-1 w-5 h-5 accent-[#173E6F]" />
                <span>
                  <span class="block font-bold {checked[it.id] ? 'text-[#1E7A4C]' : 'text-man-nuit'}">{it.t}</span>
                  <span class="block text-[15px] text-[#4A6285]">{it.d}</span>
                </span>
              </label>
            {/each}
          </div>
        </fieldset>
      {/each}
    </div>
  </section>
</div>
