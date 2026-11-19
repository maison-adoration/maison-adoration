<script>
  import Container from "./../components/utils/Container.svelte";
  import get from "lodash.get";
  import config from "../stores/config";
  import AsAdmin from "../components/index/AsAdmin.svelte";
  import SectionsAdmin from "../components/admin/SectionsAdmin.svelte";
  import KidsAdmin from "../components/admin/KidsAdmin.svelte";
  import UsersAdmin from "../components/admin/UsersAdmin.svelte";
  import Loading from "../components/utils/Loading.svelte";

  const TABS = [
    { id: "contenus", label: "Contenus", icon: "albums-outline" },
    { id: "pages", label: "Pages du site", icon: "document-text-outline" },
    { id: "kids", label: "Man Kids", icon: "happy-outline" },
    { id: "users", label: "Utilisateurs", icon: "people-outline" },
  ];

  let tab = (typeof location !== "undefined" && location.hash.slice(1)) || "contenus";
  $: if (!TABS.some((t) => t.id == tab)) tab = "contenus";
  const select = (id) => {
    tab = id;
    history.replaceState(null, "", `#${id}`);
  };
</script>

<svelte:head>
  <title>Administration - M.A.N.</title>
</svelte:head>

<div class="min-h-screen pt-20 pb-10">
  {#if ["admin", "super-admin"].includes(get($config, "currentUser.role"))}
    <Container>
      <h1 class="h-font text-4xl text-brand-primary mb-4">Administration</h1>
      <div class="flex flex-wrap gap-2 mb-6 border-b border-gray-200 pb-3">
        {#each TABS as t}
          <button
            class="flex items-center px-3 py-2 rounded-md text-sm"
            class:bg-brand-primary={tab == t.id}
            class:text-white={tab == t.id}
            class:bg-white={tab != t.id}
            on:click={() => select(t.id)}
          >
            <ion-icon name={t.icon} class="text-lg mr-2"></ion-icon>
            {t.label}
          </button>
        {/each}
      </div>

      {#if tab == "contenus"}
        <AsAdmin />
      {:else if tab == "pages"}
        <SectionsAdmin />
      {:else if tab == "kids"}
        <KidsAdmin />
      {:else if tab == "users"}
        <UsersAdmin />
      {/if}
    </Container>
  {:else if !$config.userLoaded}
    <Loading text="Veuillez patienter" />
  {:else}
    <div class="h-screen w-full flex items-center justify-center">
      Accès réservé aux administrateurs
    </div>
  {/if}
</div>
