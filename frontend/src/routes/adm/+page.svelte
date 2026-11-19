<script>
  import Container from "../../components/utils/Container.svelte";
  import get from "lodash.get";
  import config from "../../stores/config";
  import AsAdmin from "../../components/index/AsAdmin.svelte";
  import SectionsAdmin from "../../components/admin/SectionsAdmin.svelte";
  import KidsAdmin from "../../components/admin/KidsAdmin.svelte";
  import UsersAdmin from "../../components/admin/UsersAdmin.svelte";
  import MediaAdmin from "../../components/admin/media/MediaAdmin.svelte";
  import PaymentsAdmin from "../../components/admin/PaymentsAdmin.svelte";
  import Loading from "../../components/utils/Loading.svelte";

  const ALL_TABS = [
    { id: "contenus", label: "Contenus", icon: "albums-outline", roles: ["admin", "super-admin"] },
    { id: "pages", label: "Pages du site", icon: "document-text-outline", roles: ["admin", "super-admin"] },
    { id: "media", label: "Médias", icon: "videocam-outline", roles: ["media", "admin", "super-admin"] },
    { id: "payments", label: "Paiements", icon: "wallet-outline", roles: ["admin", "super-admin"] },
    { id: "kids", label: "Man Kids", icon: "happy-outline", roles: ["admin", "super-admin"] },
    { id: "users", label: "Utilisateurs", icon: "people-outline", roles: ["admin", "super-admin"] },
  ];

  $: role = get($config, "currentUser.role");
  $: TABS = ALL_TABS.filter((t) => t.roles.includes(role));
  let tab = (typeof location !== "undefined" && location.hash.slice(1)) || "contenus";
  $: if (TABS.length && !TABS.some((t) => t.id == tab)) tab = TABS[0].id;
  const select = (id) => {
    tab = id;
    history.replaceState(null, "", `#${id}`);
  };
</script>

<svelte:head>
  <title>Administration - M.A.N.</title>
</svelte:head>

<div class="min-h-screen pt-20 pb-10">
  {#if ["media", "admin", "super-admin"].includes(role)}
    <Container>
      <h1 class="h-font text-4xl text-brand-primary mb-4">{role == "media" ? "Espace média" : "Administration"}</h1>
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
      {:else if tab == "media"}
        <MediaAdmin />
      {:else if tab == "payments"}
        <PaymentsAdmin />
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
