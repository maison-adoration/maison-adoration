<script>
  // Gestion de l'église : le travail quotidien de l'équipe (accueil, Man Kids,
  // médiathèque, ressources, pages, dons, membres). L'administration technique
  // (rôles, suppression de comptes, services) est dans /systeme.
  import get from "lodash.get";
  import config from "../../stores/config";
  import AdminShell from "../../components/admin/AdminShell.svelte";
  import OverviewAdmin from "../../components/admin/OverviewAdmin.svelte";
  import EventsAdmin from "../../components/admin/EventsAdmin.svelte";
  import VisitsAdmin from "../../components/admin/VisitsAdmin.svelte";
  import KidsAdmin from "../../components/admin/KidsAdmin.svelte";
  import MediaAdmin from "../../components/admin/media/MediaAdmin.svelte";
  import AsAdmin from "../../components/index/AsAdmin.svelte";
  import SectionsAdmin from "../../components/admin/SectionsAdmin.svelte";
  import PaymentsAdmin from "../../components/admin/PaymentsAdmin.svelte";
  import AccountList from "../../components/admin/AccountList.svelte";
  import AdminGate from "../../components/admin/AdminGate.svelte";

  const CHURCH = ["admin", "super-admin"];
  const ALL_TABS = [
    { id: "overview", label: "Vue d'ensemble", roles: CHURCH },
    { id: "events", label: "Événements", roles: CHURCH },
    { id: "visits", label: "Visiteurs", roles: CHURCH },
    { id: "kids", label: "Man Kids", roles: CHURCH },
    { id: "media", label: "Médiathèque", roles: ["media", ...CHURCH] },
    { id: "contenus", label: "Ressources", roles: CHURCH },
    { id: "pages", label: "Pages du site", roles: CHURCH },
    { id: "payments", label: "Dons et paiements", roles: CHURCH },
    { id: "members", label: "Membres", roles: CHURCH },
  ];

  $: role = get($config, "currentUser.role");
  let counts = {};
  $: TABS = ALL_TABS.filter((t) => t.roles.includes(role)).map((t) => ({
    ...t,
    badge: t.id === "visits" ? counts.visits : t.id === "kids" ? counts.kids : 0,
  }));
  let tab = (typeof location !== "undefined" && location.hash.slice(1)) || "";
  $: if (TABS.length && !TABS.some((t) => t.id == tab)) tab = TABS[0].id;
  const select = (id) => {
    tab = id;
    history.replaceState(null, "", `#${id}`);
    window.scrollTo({ top: 0 });
  };
  // Liens directs vers un onglet (#visits, #services…), même page déjà ouverte.
  const onHash = () => {
    const h = location.hash.slice(1);
    if (h && h !== tab) tab = h;
  };
</script>

<svelte:window on:hashchange={onHash} />

<svelte:head>
  <title>Gestion de l'église - M.A.N.</title>
</svelte:head>

<AdminGate roles={["media", ...CHURCH]}>
  <AdminShell
    space="gestion"
    title={role == "media" ? "Médiathèque" : "Gestion de l'église"}
    tabs={role == "media" ? [] : TABS}
    {tab}
    on:select={(e) => select(e.detail)}
  >
    {#if tab == "overview"}
      <OverviewAdmin on:go={(e) => select(e.detail)} on:counts={(e) => (counts = e.detail)} />
    {:else if tab == "events"}
      <EventsAdmin />
    {:else if tab == "visits"}
      <VisitsAdmin />
    {:else if tab == "kids"}
      <KidsAdmin />
    {:else if tab == "media"}
      <MediaAdmin />
    {:else if tab == "contenus"}
      <AsAdmin />
    {:else if tab == "pages"}
      <SectionsAdmin />
    {:else if tab == "payments"}
      <PaymentsAdmin />
    {:else if tab == "members"}
      <AccountList mode="members" />
    {/if}
  </AdminShell>
</AdminGate>
