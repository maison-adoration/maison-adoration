<script>
  // Administration du système (super-admin) : équipe et rôles, comptes, services.
  import AdminShell from "../../components/admin/AdminShell.svelte";
  import AdminGate from "../../components/admin/AdminGate.svelte";
  import AccountList from "../../components/admin/AccountList.svelte";
  import ServicesAdmin from "../../components/admin/ServicesAdmin.svelte";

  const TABS = [
    { id: "team", label: "Équipe et rôles" },
    { id: "accounts", label: "Comptes" },
    { id: "services", label: "Services" },
  ];
  let tab = (typeof location !== "undefined" && location.hash.slice(1)) || "team";
  $: if (!TABS.some((t) => t.id == tab)) tab = "team";
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
  <title>Administration du système - M.A.N.</title>
</svelte:head>

<AdminGate roles={["super-admin"]} what="L'administration du système est réservée aux super-administrateurs.">
  <AdminShell
    space="systeme"
    title="Administration du système"
    intro="Rôles de l'équipe, comptes et services techniques du site."
    tabs={TABS}
    {tab}
    on:select={(e) => select(e.detail)}
  >
    {#key tab}
      {#if tab == "team"}
        <AccountList mode="team" />
      {:else if tab == "accounts"}
        <AccountList mode="accounts" />
      {:else}
        <ServicesAdmin />
      {/if}
    {/key}
  </AdminShell>
</AdminGate>
