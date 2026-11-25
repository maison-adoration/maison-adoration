<script>
  // Événements (gestion de l'église) : liste, création / modification, inscrits.
  import { onMount, tick } from "svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";
  import { cdn } from "../../utils/cdn";
  import { download, today } from "../../utils/download";
  import { when, dayNum, monthShort, FALLBACK_IMAGE } from "../../utils/events";
  import Field from "../auth/Field.svelte";
  import FormAlert from "../auth/FormAlert.svelte";
  import Modal from "../utils/Modal.svelte";

  const TZ = "Africa/Lubumbashi";
  const PHOTOS = ["assemblee-large", "adoration", "predication", "fideles", "enseignement", "sanctuaire"].map((n) => `/images/design/${n}.jpg`);
  const STATUS = { registered: "Inscrit", attended: "Présent", cancelled: "Annulé" };

  let view = "list"; // list | edit | people
  let events = null;
  let listError = "";
  let notice = { text: "", kind: "success" };

  async function loadEvents() {
    listError = "";
    try {
      events = (await api.get("/events/admin/all")).data;
    } catch (err) {
      events = [];
      listError = errorMessage(err, "Les événements n'ont pas pu être chargés.");
    }
  }
  onMount(loadEvents);

  const isPast = (e) => new Date(e.endsAt || e.startsAt) < new Date();
  const top = async () => { await tick(); window.scrollTo({ top: 0 }); };

  // --- Dates : saisie à l'heure de Lubumbashi (UTC+2, sans heure d'été) ----
  const toInput = (iso) => {
    if (!iso) return "";
    const d = new Date(new Date(iso).getTime() + 2 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  };
  const fromInput = (v) => (v ? new Date(`${v}:00+02:00`).toISOString() : null);

  // --- Création / modification -------------------------------------------
  let form = null;
  let editing = null;
  let errors = {};
  let saveMsg = "";
  let saving = false;
  let file = null;

  const blank = () => ({
    title: "", description: "", location: "Sanctuaire M.A.N, 2094 avenue Kapenda, Lubumbashi",
    startsAt: "", endsAt: "", registrationMode: "", capacity: "", registrationDeadline: "",
    isPublished: true, isFeatured: true, imageUrl: PHOTOS[0],
  });

  function openEdit(e = null) {
    editing = e;
    submitted = false;
    errors = {};
    saveMsg = "";
    file = null;
    form = e
      ? {
          title: e.title, description: e.description, location: e.location,
          startsAt: toInput(e.startsAt), endsAt: toInput(e.endsAt), registrationMode: e.registrationMode,
          capacity: e.capacity ?? "", registrationDeadline: toInput(e.registrationDeadline),
          isPublished: e.isPublished, isFeatured: e.isFeatured, imageUrl: e.imageUrl || PHOTOS[0],
        }
      : blank();
    view = "edit";
    top();
  }

  let submitted = false;
  // Après une première tentative, les erreurs se mettent à jour pendant la saisie.
  $: if (submitted && form) validate(form);
  function validate(form) {
    const required = form.registrationMode === "required";
    errors = {
      title: form.title.trim().length >= 3 ? "" : "Donnez un titre (3 caractères minimum).",
      startsAt: form.startsAt ? "" : "Indiquez la date et l'heure de début.",
      endsAt: form.endsAt && form.startsAt && form.endsAt < form.startsAt ? "La fin doit être après le début." : "",
      registrationMode: form.registrationMode ? "" : "Choisissez : entrée libre ou sur inscription.",
      capacity: required && form.capacity !== "" && !(Number(form.capacity) >= 1) ? "Indiquez un nombre de places, ou laissez vide." : "",
      registrationDeadline: required && form.registrationDeadline && form.startsAt && form.registrationDeadline > form.startsAt ? "La clôture doit précéder le début." : "",
    };
    if (!Object.values(errors).some(Boolean)) saveMsg = "";
    return !Object.values(errors).some(Boolean);
  }

  async function save() {
    saveMsg = "";
    submitted = true;
    const required = form.registrationMode === "required";
    if (!validate(form)) {
      saveMsg = "Corrigez les champs signalés.";
      return;
    }
    saving = true;
    try {
      const body = {
        title: form.title.trim(), description: form.description.trim(), location: form.location.trim(),
        startsAt: fromInput(form.startsAt), endsAt: fromInput(form.endsAt), registrationMode: form.registrationMode,
        capacity: required && form.capacity !== "" ? Number(form.capacity) : null,
        registrationDeadline: required ? fromInput(form.registrationDeadline) : null,
        isPublished: form.isPublished, isFeatured: form.isFeatured,
        imageUrl: form.imageUrl && (form.imageUrl.startsWith("/images/design/") || form.imageUrl.startsWith("https://res.cloudinary.com/")) ? form.imageUrl : null,
      };
      const res = editing ? await api.put(`/events/${editing.id}`, body) : await api.post("/events", body);
      if (file) {
        const fd = new FormData();
        fd.append("poster", file);
        try {
          await api.put(`/events/${res.data.id}/image`, fd);
        } catch (err) {
          notice = { text: `Événement enregistré, mais la photo n'a pas été envoyée : ${errorMessage(err)}`, kind: "error" };
        }
      }
      if (!file || notice.kind !== "error") notice = { text: editing ? "Événement mis à jour." : `Événement « ${body.title} » créé${body.isPublished ? " et publié" : ""}.`, kind: "success" };
      view = "list";
      await loadEvents();
      top();
    } catch (err) {
      saveMsg = errorMessage(err, "L'événement n'a pas été enregistré.");
    } finally {
      saving = false;
    }
  }

  let deleting = null;
  async function remove() {
    try {
      await api.delete(`/events/${deleting.id}`);
      notice = { text: `« ${deleting.title} » a été supprimé, avec ses inscriptions.`, kind: "success" };
      deleting = null;
      view = "list";
      loadEvents();
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
      deleting = null;
    }
  }

  // --- Inscrits ----------------------------------------------------------
  let current = null;
  let people = null;
  let search = "";
  let typing;
  let exporting = false;

  async function loadPeople() {
    try {
      people = (await api.get(`/events/${current.id}/registrations`, { params: { search } })).data;
    } catch (err) {
      people = [];
      notice = { text: errorMessage(err), kind: "error" };
    }
  }
  function openPeople(e) {
    current = e;
    people = null;
    search = "";
    view = "people";
    loadPeople();
    top();
  }
  const onSearch = () => { clearTimeout(typing); typing = setTimeout(loadPeople, 300); };

  async function setStatus(r, status) {
    try {
      const updated = (await api.put(`/events/${current.id}/registrations/${r.id}`, { status })).data;
      people = people.map((p) => (p.id === r.id ? updated : p));
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    }
  }
  let removing = null;
  async function removePerson() {
    try {
      await api.delete(`/events/${current.id}/registrations/${removing.id}`);
      people = people.filter((p) => p.id !== removing.id);
      removing = null;
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
      removing = null;
    }
  }
  async function exportPeople() {
    exporting = true;
    try {
      await download(`/events/${current.id}/registrations.xlsx`, `inscrits-${current.title.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${today()}.xlsx`);
    } catch (err) {
      notice = { text: errorMessage(err, "L'export n'a pas pu être préparé."), kind: "error" };
    } finally {
      exporting = false;
    }
  }

  $: active = people ? people.filter((p) => p.status !== "cancelled") : [];
  $: seatsTaken = active.reduce((n, p) => n + p.seats, 0);
  $: present = people ? people.filter((p) => p.status === "attended").reduce((n, p) => n + p.seats, 0) : 0;
  const shortDate = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: TZ });
</script>

<div class="mb-4"><FormAlert light message={notice.text || listError} kind={listError && !notice.text ? "error" : notice.kind} /></div>

{#if view === "list"}
  <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
    <p class="text-[#2B3F5C]">Les événements publiés apparaissent sur le site ; celui « annoncé sur l'accueil » est mis en avant.</p>
    <button type="button" class="btn-or !min-h-[44px]" on:click={() => openEdit()}>Créer un événement</button>
  </div>

  {#if events === null}
    <div class="grid gap-3" aria-busy="true" aria-label="Chargement">{#each [0, 1, 2] as _}<div class="h-[110px] rounded-2xl bg-white animate-pulse"></div>{/each}</div>
  {:else if events.length === 0 && !listError}
    <div class="rounded-2xl bg-white p-8 flex flex-col items-start gap-3">
      <p class="font-slab font-bold text-[22px] text-man-nuit">Aucun événement pour l'instant</p>
      <p class="text-[#2B3F5C]">Créez le premier : il pourra être annoncé sur l'accueil, en entrée libre ou sur inscription.</p>
      <button type="button" class="btn-or !min-h-[44px] mt-1" on:click={() => openEdit()}>Créer un événement</button>
    </div>
  {:else}
    <ul class="grid gap-3">
      {#each events as e (e.id)}
        <li class="rounded-2xl bg-white p-4 flex flex-col md:flex-row md:items-center gap-4 {isPast(e) ? 'opacity-75' : ''}">
          <div class="flex items-center gap-4 flex-1 min-w-0">
            <div class="shrink-0 w-[58px] rounded-xl text-center py-1.5 {isPast(e) ? 'bg-[#EEF2F8] text-[#2B3F5C]' : 'bg-man-or text-man-nuit'}" aria-hidden="true">
              <div class="font-slab font-bold text-[24px] leading-none">{dayNum(e.startsAt)}</div>
              <div class="font-extrabold text-[12px]">{monthShort(e.startsAt)}</div>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-bold text-man-nuit text-[17px]">{e.title}</span>
                {#if isPast(e)}<span class="rounded-full bg-[#EEF2F8] px-2.5 py-0.5 text-[13px] font-bold text-[#2B3F5C]">Passé</span>
                {:else if !e.isPublished}<span class="rounded-full bg-[#FFF4D6] px-2.5 py-0.5 text-[13px] font-bold text-[#7A5600]">Brouillon</span>
                {:else if e.isFeatured}<span class="rounded-full bg-man-nuit px-2.5 py-0.5 text-[13px] font-bold text-white">Sur l'accueil</span>{/if}
                <span class="rounded-full px-2.5 py-0.5 text-[13px] font-bold {e.registrationMode === 'required' ? 'bg-[#EAF3FB] text-man-marine' : 'bg-[#EEF2F8] text-[#2B3F5C]'}">{e.registrationMode === "required" ? "Sur inscription" : "Entrée libre"}</span>
              </div>
              <div class="text-[15px] text-[#2B3F5C] first-letter:uppercase truncate">{when(e)}{e.location ? `, ${e.location}` : ""}</div>
              {#if e.registrationMode === "required"}
                <div class="text-sm text-[#4A6285]">
                  {e.registrations} inscription{e.registrations > 1 ? "s" : ""}, {e.seatsTaken} personne{e.seatsTaken > 1 ? "s" : ""}{e.capacity ? ` sur ${e.capacity} places` : ""}{e.registrationDeadline ? `, clôture le ${shortDate(e.registrationDeadline)}` : ""}
                </div>
              {/if}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            {#if e.registrationMode === "required"}<button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => openPeople(e)}>Inscrits ({e.seatsTaken})</button>{/if}
            <button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => openEdit(e)}>Modifier</button>
            {#if e.isPublished && !isPast(e)}<a class="btn-line !min-h-[40px] !text-[14px]" href="/evenements#{e.id}" target="_blank" rel="noopener">Voir sur le site</a>{/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}

{:else if view === "edit"}
  <button type="button" class="font-bold text-man-marine hover:underline mb-4" on:click={() => (view = "list")}>← Tous les événements</button>
  <form on:submit|preventDefault={save} novalidate class="grid gap-6">
    <section class="rounded-[22px] bg-white p-6 md:p-8 grid gap-5" aria-labelledby="ev-t1">
      <h2 id="ev-t1" class="font-slab font-bold text-[24px] text-man-nuit">{editing ? "Modifier l'événement" : "Nouvel événement"}</h2>
      <Field light label="Titre" name="e-title" bind:value={form.title} error={errors.title} required maxlength={160} placeholder="Ex. Nuit de louange" />
      <div class="grid md:grid-cols-2 gap-5">
        <div class="flex flex-col gap-2 min-w-0">
          <label for="e-start" class="text-sm font-bold text-man-nuit">Début</label>
          <input id="e-start" type="datetime-local" bind:value={form.startsAt} aria-invalid={errors.startsAt ? "true" : undefined} aria-describedby={errors.startsAt ? "e-start-err" : "e-start-hint"} class="man-input h-[52px] rounded-2xl bg-white border-[1.5px] px-4 text-man-nuit focus:border-man-marine focus:outline-none {errors.startsAt ? 'border-[#B3261E]' : 'border-[#C9D6E8]'}" />
          {#if errors.startsAt}<p id="e-start-err" class="text-sm text-[#B3261E]">{errors.startsAt}</p>{:else}<p id="e-start-hint" class="text-sm text-[#4A6285]">Heure de Lubumbashi.</p>{/if}
        </div>
        <div class="flex flex-col gap-2 min-w-0">
          <label for="e-end" class="text-sm font-bold text-man-nuit">Fin <span class="font-normal text-[#4A6285]">(facultatif)</span></label>
          <input id="e-end" type="datetime-local" bind:value={form.endsAt} aria-invalid={errors.endsAt ? "true" : undefined} aria-describedby={errors.endsAt ? "e-end-err" : undefined} class="man-input h-[52px] rounded-2xl bg-white border-[1.5px] px-4 text-man-nuit focus:border-man-marine focus:outline-none {errors.endsAt ? 'border-[#B3261E]' : 'border-[#C9D6E8]'}" />
          {#if errors.endsAt}<p id="e-end-err" class="text-sm text-[#B3261E]">{errors.endsAt}</p>{/if}
        </div>
      </div>
      <Field light label="Lieu" name="e-location" bind:value={form.location} maxlength={200} />
      <div class="flex flex-col gap-2">
        <label for="e-desc" class="text-sm font-bold text-man-nuit">Description <span class="font-normal text-[#4A6285]">(facultatif)</span></label>
        <textarea id="e-desc" bind:value={form.description} rows="4" maxlength="4000" placeholder="Ce qui attend les participants, l'orateur, ce qu'il faut apporter…" class="man-input rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 py-3 text-man-nuit focus:border-man-marine focus:outline-none"></textarea>
      </div>
    </section>

    <section class="rounded-[22px] bg-white p-6 md:p-8" aria-labelledby="ev-t2">
      <h2 id="ev-t2" class="font-slab font-bold text-[24px] text-man-nuit">Inscription</h2>
      <fieldset class="mt-4 grid md:grid-cols-2 gap-3" aria-describedby={errors.registrationMode ? "e-mode-err" : undefined}>
        <legend class="sr-only">Les visiteurs doivent-ils s'inscrire ?</legend>
        {#each [
          { v: "none", t: "Entrée libre", d: "Pas d'inscription : l'annonce indique « Entrée libre »." },
          { v: "required", t: "Sur inscription", d: "Les visiteurs réservent leur place sur le site. Les inscrits arrivent ici, exportables en Excel." },
        ] as o}
          <label class="flex gap-3 items-start rounded-2xl border-[1.5px] p-4 cursor-pointer transition-colors duration-150 {form.registrationMode === o.v ? 'border-man-marine bg-[#EAF3FB]' : 'border-[#E1E8F1] hover:border-[#C9D6E8]'}">
            <input type="radio" name="e-mode" value={o.v} bind:group={form.registrationMode} class="mt-1 w-5 h-5 accent-[#173E6F]" />
            <span><span class="block font-bold text-man-nuit">{o.t}</span><span class="block text-[15px] text-[#4A6285]">{o.d}</span></span>
          </label>
        {/each}
      </fieldset>
      {#if errors.registrationMode}<p id="e-mode-err" class="mt-2 text-sm text-[#B3261E]">{errors.registrationMode}</p>{/if}
      {#if form.registrationMode === "required"}
        <div class="man-pop mt-5 grid md:grid-cols-2 gap-5">
          <Field light label="Nombre de places" name="e-capacity" inputmode="numeric" optional bind:value={form.capacity} error={errors.capacity} hint="Laissez vide si les places ne sont pas limitées." maxlength={6} />
          <div class="flex flex-col gap-2 min-w-0">
            <label for="e-deadline" class="text-sm font-bold text-man-nuit">Clôture des inscriptions <span class="font-normal text-[#4A6285]">(facultatif)</span></label>
            <input id="e-deadline" type="datetime-local" bind:value={form.registrationDeadline} aria-describedby={errors.registrationDeadline ? "e-dl-err" : "e-dl-hint"} class="man-input h-[52px] rounded-2xl bg-white border-[1.5px] px-4 text-man-nuit focus:border-man-marine focus:outline-none {errors.registrationDeadline ? 'border-[#B3261E]' : 'border-[#C9D6E8]'}" />
            {#if errors.registrationDeadline}<p id="e-dl-err" class="text-sm text-[#B3261E]">{errors.registrationDeadline}</p>{:else}<p id="e-dl-hint" class="text-sm text-[#4A6285]">Sinon, les inscriptions ferment au début de l'événement.</p>{/if}
          </div>
        </div>
      {/if}
    </section>

    <section class="rounded-[22px] bg-white p-6 md:p-8" aria-labelledby="ev-t3">
      <h2 id="ev-t3" class="font-slab font-bold text-[24px] text-man-nuit">Photo</h2>
      <fieldset class="mt-4">
        <legend class="text-sm font-bold text-man-nuit mb-2">Choisir une photo de la Maison</legend>
        <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
          {#each [...PHOTOS, ...(form.imageUrl && !PHOTOS.includes(form.imageUrl) ? [form.imageUrl] : [])] as ph}
            <label class="relative cursor-pointer rounded-xl overflow-hidden aspect-[4/3] outline-offset-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-man-ciel {form.imageUrl === ph && !file ? 'outline outline-[3px] outline-man-marine' : ''}">
              <input type="radio" name="e-photo" value={ph} bind:group={form.imageUrl} on:change={() => (file = null)} class="sr-only" />
              <img src={cdn(ph, 240)} alt="" class="w-full h-full object-cover" loading="lazy" />
              <span class="sr-only">Photo {PHOTOS.indexOf(ph) + 1}</span>
            </label>
          {/each}
        </div>
      </fieldset>
      <div class="mt-4 flex flex-wrap items-center gap-3">
        <label for="e-file" class="btn-line !min-h-[44px] cursor-pointer">Envoyer une autre photo</label>
        <input id="e-file" type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" on:change={(ev) => (file = ev.currentTarget.files[0] || null)} />
        {#if file}<span class="text-[15px] text-man-nuit">{file.name}</span>{/if}
        <span class="text-sm text-[#4A6285]">JPG, PNG ou WebP, 10 Mo maximum.</span>
      </div>
    </section>

    <section class="rounded-[22px] bg-white p-6 md:p-8 grid gap-3" aria-labelledby="ev-t4">
      <h2 id="ev-t4" class="font-slab font-bold text-[24px] text-man-nuit">Publication</h2>
      <label class="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" bind:checked={form.isPublished} class="mt-1 w-5 h-5 accent-[#173E6F]" />
        <span><span class="block font-bold text-man-nuit">Publier sur le site</span><span class="block text-[15px] text-[#4A6285]">Visible sur la page Événements. Décoché, l'événement reste un brouillon.</span></span>
      </label>
      <label class="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" bind:checked={form.isFeatured} class="mt-1 w-5 h-5 accent-[#173E6F]" />
        <span><span class="block font-bold text-man-nuit">Annoncer sur l'accueil</span><span class="block text-[15px] text-[#4A6285]">Si plusieurs événements sont annoncés, l'accueil montre le plus proche.</span></span>
      </label>
    </section>

    <FormAlert light message={saveMsg} />
    <div class="flex flex-wrap gap-3">
      <button type="submit" class="btn-or" disabled={saving} aria-busy={saving}>{saving ? "Enregistrement…" : editing ? "Enregistrer les modifications" : form.isPublished ? "Créer et publier" : "Créer le brouillon"}</button>
      <button type="button" class="btn-line" on:click={() => (view = "list")}>Annuler</button>
      {#if editing}<button type="button" class="btn-line md:ml-auto !text-[#B3261E] !border-[#B3261E]" on:click={() => (deleting = editing)}>Supprimer l'événement</button>{/if}
    </div>
  </form>

{:else if view === "people"}
  <button type="button" class="font-bold text-man-marine hover:underline mb-4" on:click={() => ((view = "list"), loadEvents())}>← Tous les événements</button>
  <section class="rounded-[22px] bg-man-nuit text-white p-6 md:p-7 flex flex-col md:flex-row md:items-end gap-5">
    <div class="flex-1 min-w-0">
      <h2 class="font-slab font-bold text-[26px] leading-tight">{current.title}</h2>
      <p class="text-man-doux first-letter:uppercase">{when(current)}{current.location ? `, ${current.location}` : ""}</p>
      {#if people}
        <dl class="mt-4 flex flex-wrap gap-x-8 gap-y-2">
          <div><dt class="text-sm text-man-doux">Inscriptions</dt><dd class="font-slab font-bold text-[28px]">{active.length}</dd></div>
          <div><dt class="text-sm text-man-doux">Personnes attendues</dt><dd class="font-slab font-bold text-[28px]">{seatsTaken}{current.capacity ? ` / ${current.capacity}` : ""}</dd></div>
          <div><dt class="text-sm text-man-doux">Présents</dt><dd class="font-slab font-bold text-[28px]">{present}</dd></div>
        </dl>
      {/if}
    </div>
    <button type="button" class="btn-or shrink-0" on:click={exportPeople} disabled={exporting} aria-busy={exporting}>{exporting ? "Préparation…" : "Exporter en Excel"}</button>
  </section>

  <div class="relative md:w-[340px] mt-5 mb-4">
    <label for="p-search" class="sr-only">Rechercher un inscrit</label>
    <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6285] pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    <input id="p-search" type="search" bind:value={search} on:input={onSearch} placeholder="Nom, téléphone ou e-mail" autocomplete="off" class="man-input w-full h-12 rounded-full bg-white border-[1.5px] border-[#C9D6E8] pl-11 pr-4 text-man-nuit focus:border-man-marine focus:outline-none" />
  </div>

  {#if people === null}
    <div class="grid gap-2" aria-busy="true" aria-label="Chargement des inscrits">{#each [0, 1, 2] as _}<div class="h-[68px] rounded-2xl bg-white animate-pulse"></div>{/each}</div>
  {:else if people.length === 0}
    <div class="rounded-2xl bg-white p-6 text-man-nuit">{search ? "Aucun inscrit ne correspond à cette recherche." : "Personne ne s'est encore inscrit. Partagez la page Événements du site."}</div>
  {:else}
    <ul class="grid gap-2">
      {#each people as p (p.id)}
        <li class="rounded-2xl bg-white px-4 py-3 flex flex-col md:flex-row md:items-center gap-3 {p.status === 'cancelled' ? 'opacity-60' : ''}">
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold text-man-nuit">{p.name}</span>
              {#if p.seats > 1}<span class="rounded-full bg-[#EEF2F8] px-2.5 py-0.5 text-[13px] font-bold text-[#2B3F5C]">{p.seats} personnes</span>{/if}
              <span class="rounded-full px-2.5 py-0.5 text-[13px] font-bold {p.status === 'attended' ? 'bg-[#E7F6EE] text-[#0F4A2D]' : p.status === 'cancelled' ? 'bg-[#FDECEA] text-[#7A1A14]' : 'bg-[#EAF3FB] text-man-marine'}">{STATUS[p.status]}</span>
            </div>
            <div class="text-[15px] text-[#2B3F5C]">
              <a class="underline" href="tel:{p.phone}">{p.phone}</a>{p.email ? `, ${p.email}` : ""}
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            {#if p.status !== "attended"}<button type="button" class="btn-or !min-h-[40px] !text-[14px]" on:click={() => setStatus(p, "attended")}>Marquer présent</button>
            {:else}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => setStatus(p, "registered")}>Annuler la présence</button>{/if}
            {#if p.status !== "cancelled"}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => setStatus(p, "cancelled")}>Annuler l'inscription</button>
            {:else}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => setStatus(p, "registered")}>Rétablir</button>{/if}
            <button type="button" class="btn-line !min-h-[40px] !text-[14px] !text-[#B3261E] !border-[#B3261E]" on:click={() => (removing = p)}>Retirer</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
{/if}

<Modal show={Boolean(deleting)} title="Supprimer l'événement ?" on:modalClose={() => (deleting = null)}>
  {#if deleting}
    <p class="text-[#2B3F5C]"><strong class="text-man-nuit">{deleting.title}</strong> disparaîtra du site, avec toutes ses inscriptions{deleting.registrations ? ` (${deleting.registrations})` : ""}. Pensez à exporter la liste avant.</p>
    <p class="mt-2 font-bold text-[#B3261E]">Cette action est irréversible.</p>
    <button type="button" class="btn-or w-full mt-5 !bg-[#B3261E] !text-white" on:click={remove}>Supprimer définitivement</button>
  {/if}
</Modal>

<Modal show={Boolean(removing)} title="Retirer cet inscrit ?" on:modalClose={() => (removing = null)}>
  {#if removing}
    <p class="text-[#2B3F5C]">L'inscription de <strong class="text-man-nuit">{removing.name}</strong> sera supprimée et ses places libérées. Pour garder une trace, choisissez plutôt « Annuler l'inscription ».</p>
    <button type="button" class="btn-or w-full mt-5 !bg-[#B3261E] !text-white" on:click={removePerson}>Retirer définitivement</button>
  {/if}
</Modal>
