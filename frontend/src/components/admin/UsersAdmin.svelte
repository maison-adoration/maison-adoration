<script>
  // Gestion des comptes : recherche, création d'admin, rôles, suppression.
  import { onMount } from "svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";
  import Modal from "../utils/Modal.svelte";

  const ROLE_LABEL = { user: "Membre", media: "Équipe média", admin: "Admin", "super-admin": "Super-admin" };

  let users = null;
  let search = "";
  let role = "";
  let page = 1;

  $: me = $config.currentUser || {};
  $: isSuper = me.role == "super-admin";

  const load = async () => {
    users = null;
    try {
      const res = await api.get("/users", { params: { page, search, ...(role ? { role } : {}) } });
      users = res.data;
    } catch (err) {
      users = [];
      alert(errorMessage(err));
    }
  };

  const changeRole = async (u, newRole) => {
    if (!confirm(`Donner le rôle « ${ROLE_LABEL[newRole]} » à ${u.name} ?`)) return;
    try {
      await api.put(`/users/${u.id}/role`, { role: newRole });
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  const remove = async (u) => {
    if (!confirm(`Supprimer définitivement le compte de ${u.name} (${u.email}) ? Ses accès aux contenus seront perdus.`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      load();
    } catch (err) {
      alert(errorMessage(err));
    }
  };

  // Création de compte
  let showCreate = false;
  let creating = false;
  let form = { name: "", email: "", password: "", tel: "", role: "user" };

  const create = async () => {
    if (form.password.length < 8) return alert("Le mot de passe doit faire au moins 8 caractères.");
    creating = true;
    try {
      await api.post("/users", form);
      showCreate = false;
      form = { name: "", email: "", password: "", tel: "", role: "user" };
      load();
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      creating = false;
    }
  };

  onMount(load);
</script>

<Modal show={showCreate} on:modalClose={() => (showCreate = false)}>
  <form on:submit|preventDefault={create} class="grid gap-2">
    <div class="h-font text-2xl text-brand-primary">Nouveau compte</div>
    <input bind:value={form.name} placeholder="Nom complet" required />
    <input bind:value={form.email} type="email" placeholder="E-mail" required />
    <input bind:value={form.tel} placeholder="Téléphone (facultatif)" />
    <input bind:value={form.password} type="password" placeholder="Mot de passe provisoire (8 caractères min.)" required />
    {#if isSuper}
      <select bind:value={form.role}>
        <option value="user">Membre</option>
        <option value="media">Équipe média</option>
        <option value="admin">Admin</option>
      </select>
    {/if}
    <button type="submit" class="btn btn-third" disabled={creating}>{creating ? "Création..." : "Créer le compte"}</button>
  </form>
</Modal>

<div class="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
  <input class="md:col-span-2" bind:value={search} placeholder="Rechercher (nom, e-mail, téléphone)" on:keydown={(e) => e.key == "Enter" && ((page = 1), load())} />
  <select bind:value={role} on:change={() => ((page = 1), load())}>
    <option value="">Tous les rôles</option>
    <option value="user">Membres</option>
    <option value="media">Équipe média</option>
    <option value="admin">Admins</option>
    <option value="super-admin">Super-admins</option>
  </select>
  <button class="btn btn-secondary" on:click={() => ((page = 1), load())}>Rechercher</button>
</div>
<button class="btn btn-primary mb-4" on:click={() => (showCreate = true)}>+ Créer un compte</button>

{#if users == null}
  <Loading text="Veuillez patienter" />
{:else}
  <div class="grid grid-cols-1 gap-2">
    {#each users as u (u.id)}
      <div class="flex flex-col md:flex-row md:items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm">
        <div class="flex-1">
          <div class="font-bold text-gray-800">{u.name} <span class="text-xs text-brand-primary">{ROLE_LABEL[u.role]}</span></div>
          <div class="text-gray-600">{u.email}{u.tel ? ` · ${u.tel}` : ""}{u.country ? ` · ${u.country}` : ""}</div>
          <div class="text-xs text-gray-400">Inscrit le {new Date(u.createdAt).toLocaleDateString("fr-FR")}</div>
        </div>
        {#if u.id != me.id}
          <div class="flex flex-wrap gap-2">
            {#if isSuper}
              {#if u.role != "media"}<button class="btn btn-aurora !py-1 !text-xs" on:click={() => changeRole(u, "media")}>Équipe média</button>{/if}
              {#if u.role != "admin"}<button class="btn btn-aurora !py-1 !text-xs" on:click={() => changeRole(u, "admin")}>Rendre admin</button>{/if}
              {#if u.role != "user"}<button class="btn btn-aurora !py-1 !text-xs" on:click={() => changeRole(u, "user")}>Rendre membre</button>{/if}
              {#if u.role != "super-admin"}<button class="btn btn-aurora !py-1 !text-xs" on:click={() => changeRole(u, "super-admin")}>Rendre super-admin</button>{/if}
            {/if}
            {#if u.role != "super-admin" && (isSuper || u.role == "user" || u.role == "media")}
              <button class="btn btn-aurora !py-1 !text-xs" on:click={() => remove(u)}>Supprimer</button>
            {/if}
          </div>
        {/if}
      </div>
    {:else}
      <Empty text="Aucun compte trouvé" />
    {/each}
  </div>
  <div class="flex justify-center gap-3 mt-4">
    {#if page > 1}<button class="btn btn-aurora" on:click={() => ((page -= 1), load())}>← Précédent</button>{/if}
    {#if users.length >= 50}<button class="btn btn-aurora" on:click={() => ((page += 1), load())}>Suivant →</button>{/if}
  </div>
{/if}
