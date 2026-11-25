<script>
  // Liste des comptes, avec des actions différentes selon l'espace :
  //  - mode « members »  (Gestion de l'église) : fidèles, export, compte membre,
  //    mot de passe provisoire d'un membre ;
  //  - mode « team »     (Administration du système) : équipe et rôles ;
  //  - mode « accounts » (Administration du système) : mot de passe provisoire
  //    de tout compte (hors super-admin) et suppression.
  import { onMount } from "svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";
  import Modal from "../utils/Modal.svelte";
  import Field from "../auth/Field.svelte";
  import FormAlert from "../auth/FormAlert.svelte";
  import countries from "../../stores/countries";
  import { countryOptions } from "../../utils/countryOptions";

  export let mode = "members";

  const ROLE_LABEL = { user: "Membre", media: "Équipe média", admin: "Administrateur", "super-admin": "Super-administrateur" };
  const ROLE_HELP = {
    user: "Accès à son espace membre uniquement.",
    media: "Gère la médiathèque : sermons, podcasts, galerie, communiqués, directs.",
    admin: "Gère l'église : visiteurs, Man Kids, ressources, pages, dons, membres.",
    "super-admin": "Tout, plus l'administration du système (rôles, comptes, services).",
  };
  const STAFF = ["media", "admin", "super-admin"];

  $: me = $config.currentUser || {};
  // Pays enregistré en anglais → nom affiché en français
  $: countryFr = Object.fromEntries(countryOptions($countries).map((o) => [o.value, o.label]));
  let users = null;
  let search = "";
  let roleFilter = "";
  let page = 1;
  let loadError = "";
  let notice = { text: "", kind: "success" };

  const fetchRole = async (role) => (await api.get("/users", { params: { page: 1, search, role } })).data;

  async function load() {
    users = null;
    loadError = "";
    try {
      if (mode === "team") {
        // L'équipe : tous les comptes ayant un rôle autre que membre.
        const lists = await Promise.all(STAFF.map(fetchRole));
        users = lists.flat().sort((a, b) => STAFF.indexOf(b.role) - STAFF.indexOf(a.role) || a.name.localeCompare(b.name, "fr"));
      } else {
        users = (await api.get("/users", { params: { page, search, ...(roleFilter ? { role: roleFilter } : {}) } })).data;
      }
    } catch (err) {
      users = [];
      loadError = errorMessage(err, "La liste n'a pas pu être chargée.");
    }
  }

  let typing;
  const onSearch = () => {
    clearTimeout(typing);
    typing = setTimeout(() => ((page = 1), load()), 350);
  };

  // Ce que l'utilisateur connecté peut faire sur ce compte, dans cet espace.
  const canTempPassword = (u) =>
    u.id !== me.id && (mode === "members" ? u.role === "user" : mode === "accounts" && u.role !== "super-admin");
  const canDelete = (u) => mode === "accounts" && u.id !== me.id && u.role !== "super-admin";
  const canChangeRole = (u) => mode === "team" && u.id !== me.id;

  // --- Mot de passe provisoire -------------------------------------------
  let tempFor = null; // compte visé
  let tempPassword = "";
  let tempBusy = false;
  let copied = false;
  const askTemp = (u) => ((tempFor = u), (tempPassword = ""), (copied = false));
  const makeTemp = async () => {
    tempBusy = true;
    try {
      tempPassword = (await api.post(`/users/${tempFor.id}/temporary-password`)).data.password;
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
      tempFor = null;
    } finally {
      tempBusy = false;
    }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(tempPassword); copied = true; } catch { copied = false; }
  };

  // --- Suppression -------------------------------------------------------
  let deleteFor = null;
  let deleteBusy = false;
  const doDelete = async () => {
    deleteBusy = true;
    try {
      await api.delete(`/users/${deleteFor.id}`);
      notice = { text: `Le compte de ${deleteFor.name} a été supprimé.`, kind: "success" };
      deleteFor = null;
      load();
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
      deleteFor = null;
    } finally {
      deleteBusy = false;
    }
  };

  // --- Changement de rôle (équipe) ---------------------------------------
  let roleFor = null;
  let newRole = "user";
  let roleBusy = false;
  const askRole = (u) => ((roleFor = u), (newRole = u.role));
  const saveRole = async () => {
    if (newRole === roleFor.role) return (roleFor = null);
    roleBusy = true;
    try {
      await api.put(`/users/${roleFor.id}/role`, { role: newRole });
      notice = { text: `${roleFor.name} est maintenant : ${ROLE_LABEL[newRole].toLowerCase()}.`, kind: "success" };
      roleFor = null;
      load();
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
      roleFor = null;
    } finally {
      roleBusy = false;
    }
  };

  // Ajouter quelqu'un à l'équipe : chercher un compte existant.
  let addOpen = false;
  let addSearch = "";
  let addResults = [];
  let addTyping;
  const onAddSearch = () => {
    clearTimeout(addTyping);
    addTyping = setTimeout(async () => {
      if (addSearch.trim().length < 2) return (addResults = []);
      try {
        addResults = (await api.get("/users", { params: { page: 1, search: addSearch.trim(), role: "user" } })).data.slice(0, 6);
      } catch { addResults = []; }
    }, 300);
  };

  // --- Création de compte ------------------------------------------------
  let createOpen = false;
  let creating = false;
  let createErrors = {};
  let createMsg = "";
  let form = { name: "", email: "", tel: "", password: "", role: mode === "team" ? "media" : "user" };
  const create = async () => {
    createMsg = "";
    createErrors = {
      name: form.name.trim().length >= 2 ? "" : "Saisissez le nom complet.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) ? "" : "Saisissez une adresse e-mail valide.",
      password: form.password.length >= 8 ? "" : "8 caractères minimum.",
    };
    if (Object.values(createErrors).some(Boolean)) return;
    creating = true;
    try {
      await api.post("/users", { ...form, name: form.name.trim(), email: form.email.trim() });
      notice = { text: `Compte de ${form.name.trim()} créé. Transmettez-lui son mot de passe provisoire.`, kind: "success" };
      createOpen = false;
      form = { name: "", email: "", tel: "", password: "", role: mode === "team" ? "media" : "user" };
      load();
    } catch (err) {
      createMsg = errorMessage(err, "Le compte n'a pas pu être créé.");
    } finally {
      creating = false;
    }
  };

  // --- Export (membres) --------------------------------------------------
  let exporting = false;
  const exportMembers = async () => {
    exporting = true;
    try {
      const res = await api.get("/users/export.csv", { responseType: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(res.data);
      link.download = `inscrits-man-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      notice = { text: errorMessage(err), kind: "error" };
    } finally {
      exporting = false;
    }
  };

  const date = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  onMount(load);
</script>

<!-- Barre d'outils -->
<div class="flex flex-col md:flex-row md:items-center gap-3 mb-5">
  <div class="relative md:w-[340px]">
    <label for="acc-search-{mode}" class="sr-only">Rechercher un compte</label>
    <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-[#4A6285] pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    <input id="acc-search-{mode}" type="search" bind:value={search} on:input={onSearch} placeholder="Nom, e-mail ou téléphone" autocomplete="off" class="man-input w-full h-12 rounded-full bg-white border-[1.5px] border-[#C9D6E8] pl-11 pr-4 text-man-nuit focus:border-man-marine focus:outline-none" />
  </div>
  {#if mode === "accounts"}
    <label for="acc-role" class="sr-only">Filtrer par rôle</label>
    <select id="acc-role" bind:value={roleFilter} on:change={() => ((page = 1), load())} class="man-input h-12 rounded-full bg-white border-[1.5px] border-[#C9D6E8] px-4 text-man-nuit focus:border-man-marine focus:outline-none">
      <option value="">Tous les rôles</option>
      {#each Object.entries(ROLE_LABEL) as [k, l]}<option value={k}>{l}</option>{/each}
    </select>
  {/if}
  <div class="md:ml-auto flex flex-wrap gap-2">
    {#if mode === "members"}
      <button type="button" class="btn-line !min-h-[44px]" on:click={exportMembers} disabled={exporting} aria-busy={exporting}>{exporting ? "Préparation…" : "Exporter (Excel)"}</button>
      <button type="button" class="btn-or !min-h-[44px]" on:click={() => (createOpen = true)}>Créer un compte membre</button>
    {:else if mode === "team"}
      <button type="button" class="btn-line !min-h-[44px]" on:click={() => ((addOpen = true), (addSearch = ""), (addResults = []))}>Ajouter un membre existant</button>
      <button type="button" class="btn-or !min-h-[44px]" on:click={() => (createOpen = true)}>Créer un compte d'équipe</button>
    {/if}
  </div>
</div>

{#if mode === "team"}
  <div class="grid md:grid-cols-3 gap-3 mb-6">
    {#each STAFF as r}
      <div class="rounded-2xl bg-white px-4 py-3">
        <div class="font-bold text-man-nuit">{ROLE_LABEL[r]}</div>
        <div class="text-sm text-[#4A6285]">{ROLE_HELP[r]}</div>
      </div>
    {/each}
  </div>
{/if}

<div class="mb-4"><FormAlert light message={notice.text || loadError} kind={loadError && !notice.text ? "error" : notice.kind} /></div>

{#if users === null}
  <div class="grid gap-2" aria-busy="true" aria-label="Chargement des comptes">
    {#each [0, 1, 2, 3] as _}<div class="h-[76px] rounded-2xl bg-white animate-pulse"></div>{/each}
  </div>
{:else if users.length === 0 && !loadError}
  <div class="rounded-2xl bg-white p-6 text-man-nuit">
    {search ? "Aucun compte ne correspond à cette recherche." : mode === "team" ? "Personne n'a encore de rôle dans l'équipe." : "Aucun compte pour le moment."}
  </div>
{:else}
  <ul class="grid gap-2">
    {#each users as u (u.id)}
      <li class="flex flex-col md:flex-row md:items-center gap-3 rounded-2xl bg-white px-4 py-3">
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-bold text-man-nuit">{u.name}</span>
            {#if u.id === me.id}<span class="text-sm text-[#4A6285]">(vous)</span>{/if}
            {#if u.role !== "user" || mode !== "members"}
              <span class="rounded-full px-2.5 py-0.5 text-[13px] font-bold {u.role === 'user' ? 'bg-[#EEF2F8] text-[#2B3F5C]' : 'bg-man-nuit text-white'}">{ROLE_LABEL[u.role]}</span>
            {/if}
          </div>
          <div class="text-[15px] text-[#2B3F5C] truncate">{[u.email, u.tel, countryFr[u.country] || u.country].filter(Boolean).join(", ")}</div>
          <div class="text-sm text-[#4A6285]">Inscrit le {date(u.createdAt)}</div>
        </div>
        <div class="flex flex-wrap gap-2">
          {#if canChangeRole(u)}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => askRole(u)}>Changer le rôle</button>{/if}
          {#if canTempPassword(u)}<button type="button" class="btn-line !min-h-[40px] !text-[14px]" on:click={() => askTemp(u)}>Mot de passe provisoire</button>{/if}
          {#if canDelete(u)}<button type="button" class="btn-line !min-h-[40px] !text-[14px] !text-[#B3261E] !border-[#B3261E] hover:!bg-[#B3261E] hover:!text-white" on:click={() => (deleteFor = u)}>Supprimer</button>{/if}
        </div>
      </li>
    {/each}
  </ul>
  {#if mode !== "team"}
    <div class="flex justify-center gap-3 mt-5">
      {#if page > 1}<button type="button" class="btn-line !min-h-[44px]" on:click={() => ((page -= 1), load())}>Page précédente</button>{/if}
      {#if users.length >= 50}<button type="button" class="btn-line !min-h-[44px]" on:click={() => ((page += 1), load())}>Page suivante</button>{/if}
    </div>
  {/if}
{/if}

<!-- Mot de passe provisoire -->
<Modal show={Boolean(tempFor)} title="Mot de passe provisoire" on:modalClose={() => (tempFor = null)}>
  {#if tempFor}
    {#if !tempPassword}
      <p class="text-[#2B3F5C]">Un nouveau mot de passe sera créé pour <strong class="text-man-nuit">{tempFor.name}</strong>. L'ancien ne fonctionnera plus, et ses autres appareils seront déconnectés.</p>
      <button type="button" class="btn-or w-full mt-5" on:click={makeTemp} disabled={tempBusy} aria-busy={tempBusy}>{tempBusy ? "Création…" : "Créer le mot de passe"}</button>
    {:else}
      <p class="text-[#2B3F5C]">Transmettez-le à {tempFor.name} en privé. Il ne sera plus affiché ensuite ; {tempFor.name.split(" ")[0]} pourra le changer dans son profil.</p>
      <p class="mt-4 rounded-2xl bg-[#EEF2F8] px-4 py-3 font-mono text-[20px] tracking-wider text-man-nuit select-all break-all">{tempPassword}</p>
      <button type="button" class="btn-or w-full mt-4" on:click={copy}>{copied ? "Copié" : "Copier"}</button>
    {/if}
  {/if}
</Modal>

<!-- Suppression -->
<Modal show={Boolean(deleteFor)} title="Supprimer ce compte ?" on:modalClose={() => (deleteFor = null)}>
  {#if deleteFor}
    <p class="text-[#2B3F5C]">Le compte de <strong class="text-man-nuit">{deleteFor.name}</strong> ({deleteFor.email}) sera supprimé définitivement. Ses accès aux ressources seront perdus ; l'historique de ses paiements est conservé.</p>
    <p class="mt-2 font-bold text-[#B3261E]">Cette action est irréversible.</p>
    <button type="button" class="btn-or w-full mt-5 !bg-[#B3261E] !text-white" on:click={doDelete} disabled={deleteBusy} aria-busy={deleteBusy}>{deleteBusy ? "Suppression…" : "Supprimer définitivement"}</button>
  {/if}
</Modal>

<!-- Changement de rôle -->
<Modal show={Boolean(roleFor)} title="Changer le rôle" on:modalClose={() => (roleFor = null)}>
  {#if roleFor}
    <p class="text-[#2B3F5C] mb-4">Rôle de <strong class="text-man-nuit">{roleFor.name}</strong> :</p>
    <fieldset class="grid gap-2">
      <legend class="sr-only">Rôle</legend>
      {#each Object.entries(ROLE_LABEL) as [k, l]}
        <label class="flex gap-3 items-start rounded-2xl border-[1.5px] px-4 py-3 cursor-pointer {newRole === k ? 'border-man-marine bg-[#EEF2F8]' : 'border-[#E1E8F1]'}">
          <input type="radio" name="new-role" value={k} bind:group={newRole} class="mt-1 w-4 h-4 accent-[#173E6F]" />
          <span><span class="block font-bold text-man-nuit">{l}</span><span class="block text-sm text-[#4A6285]">{ROLE_HELP[k]}</span></span>
        </label>
      {/each}
    </fieldset>
    <button type="button" class="btn-or w-full mt-5" on:click={saveRole} disabled={roleBusy} aria-busy={roleBusy}>{roleBusy ? "Enregistrement…" : "Enregistrer le rôle"}</button>
  {/if}
</Modal>

<!-- Ajouter un membre existant à l'équipe -->
<Modal show={addOpen} title="Ajouter à l'équipe" on:modalClose={() => (addOpen = false)}>
  <label for="add-search" class="text-sm font-bold text-man-nuit">Rechercher un membre</label>
  <input id="add-search" type="search" bind:value={addSearch} on:input={onAddSearch} placeholder="Nom ou e-mail" autocomplete="off" class="man-input mt-2 w-full h-12 rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 text-man-nuit focus:border-man-marine focus:outline-none" />
  <ul class="mt-3 grid gap-2" aria-live="polite">
    {#each addResults as u (u.id)}
      <li>
        <button type="button" class="w-full text-left rounded-2xl border-[1.5px] border-[#E1E8F1] px-4 py-3 hover:border-man-marine" on:click={() => ((addOpen = false), askRole(u))}>
          <span class="block font-bold text-man-nuit">{u.name}</span>
          <span class="block text-sm text-[#4A6285] truncate">{u.email}</span>
        </button>
      </li>
    {:else}
      {#if addSearch.trim().length >= 2}<li class="text-[#4A6285]">Aucun membre trouvé.</li>{/if}
    {/each}
  </ul>
</Modal>

<!-- Création de compte -->
<Modal show={createOpen} title={mode === "team" ? "Nouveau compte d'équipe" : "Nouveau compte membre"} on:modalClose={() => (createOpen = false)}>
  <form on:submit|preventDefault={create} novalidate class="grid gap-4">
    <FormAlert light message={createMsg} />
    <Field light label="Nom complet" name="c-name-{mode}" autocomplete="off" bind:value={form.name} error={createErrors.name} required maxlength={120} />
    <Field light label="E-mail" name="c-email-{mode}" type="email" autocomplete="off" bind:value={form.email} error={createErrors.email} required />
    <Field light label="Téléphone" name="c-tel-{mode}" type="tel" optional autocomplete="off" bind:value={form.tel} maxlength={30} />
    <Field light label="Mot de passe provisoire" name="c-pass-{mode}" type="password" autocomplete="new-password" bind:value={form.password} error={createErrors.password} hint="8 caractères minimum. La personne pourra le changer dans son profil." required maxlength={128} />
    {#if mode === "team"}
      <div class="flex flex-col gap-2">
        <label for="c-role" class="text-sm font-bold text-man-nuit">Rôle</label>
        <select id="c-role" bind:value={form.role} class="man-input h-[52px] rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 text-man-nuit focus:border-man-marine focus:outline-none">
          <option value="media">{ROLE_LABEL.media}</option>
          <option value="admin">{ROLE_LABEL.admin}</option>
        </select>
        <p class="text-sm text-[#4A6285]">{ROLE_HELP[form.role]}</p>
      </div>
    {/if}
    <button type="submit" class="btn-or w-full" disabled={creating} aria-busy={creating}>{creating ? "Création…" : "Créer le compte"}</button>
  </form>
</Modal>
