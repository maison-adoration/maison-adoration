<script>
  import Container from "../../components/utils/Container.svelte";
  import get from "lodash.get";
  import config from "../../stores/config";
  import AsAdmin from "../../components/index/AsAdmin.svelte";
  import SectionsAdmin from "../../components/admin/SectionsAdmin.svelte";
  import KidsAdmin from "../../components/admin/KidsAdmin.svelte";
  import VisitsAdmin from "../../components/admin/VisitsAdmin.svelte";
  import UsersAdmin from "../../components/admin/UsersAdmin.svelte";
  import MediaAdmin from "../../components/admin/media/MediaAdmin.svelte";
  import PaymentsAdmin from "../../components/admin/PaymentsAdmin.svelte";
  import Loading from "../../components/utils/Loading.svelte";

  const ALL_TABS = [
    { id: "contenus", label: "Contenus", icon: "albums-outline", roles: ["admin", "super-admin"] },
    { id: "pages", label: "Pages du site", icon: "document-text-outline", roles: ["admin", "super-admin"] },
    { id: "media", label: "Médias", icon: "videocam-outline", roles: ["media", "admin", "super-admin"] },
    { id: "payments", label: "Paiements", icon: "wallet-outline", roles: ["admin", "super-admin"] },
    { id: "visits", label: "Visites", icon: "calendar-outline", roles: ["admin", "super-admin"] },
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

<div class="min-h-screen bg-[#F3F6FA]">
  {#if ["media", "admin", "super-admin"].includes(role)}
    <header class="bg-man-nuit text-white">
      <div class="max-w-[1240px] mx-auto px-5 md:px-10 pt-28 md:pt-32">
        <h1 class="font-slab font-bold text-[32px] md:text-[40px] leading-tight">{role == "media" ? "Espace média" : "Administration"}</h1>
        <nav class="mt-5 -mx-5 px-5 flex gap-1 overflow-x-auto whitespace-nowrap" aria-label="Sections de l'administration">
          {#each TABS as t}
            <button
              type="button"
              aria-current={tab == t.id ? "page" : undefined}
              class="relative shrink-0 inline-flex items-center gap-2 px-4 py-3 font-bold text-[15px] transition-colors duration-200 {tab == t.id ? 'text-white' : 'text-man-doux hover:text-white'}"
              on:click={() => select(t.id)}
            >
              <ion-icon name={t.icon} class="text-lg" aria-hidden="true"></ion-icon>
              {t.label}
              {#if tab == t.id}<span class="absolute left-4 right-4 bottom-0 h-[3px] rounded-t bg-man-or" aria-hidden="true"></span>{/if}
            </button>
          {/each}
        </nav>
      </div>
    </header>
    <Container>
      <div class="py-8">
      {#if tab == "contenus"}
        <AsAdmin />
      {:else if tab == "pages"}
        <SectionsAdmin />
      {:else if tab == "media"}
        <MediaAdmin />
      {:else if tab == "payments"}
        <PaymentsAdmin />
      {:else if tab == "visits"}
        <VisitsAdmin />
      {:else if tab == "kids"}
        <KidsAdmin />
      {:else if tab == "users"}
        <UsersAdmin />
      {/if}
      </div>
    </Container>
  {:else if !$config.userLoaded}
    <div class="pt-32"><Loading text="Chargement…" /></div>
  {:else}
    <div class="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-5 pt-24 text-center">
      <h1 class="font-slab font-bold text-[30px] text-man-nuit">Accès réservé</h1>
      <p class="text-[#4A6285] max-w-[420px]">Cet espace est réservé à l'équipe de la Maison. Connectez-vous avec un compte administrateur.</p>
      <a href="/login" class="btn-or">Se connecter</a>
    </div>
  {/if}
</div>
