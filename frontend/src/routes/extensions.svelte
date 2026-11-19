<script>
  import PageHero from "../components/pages/PageHero.svelte";
  import SectionsList from "../components/pages/SectionsList.svelte";
</script>

<svelte:head>
  <title>Extensions - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero
  title="Nos Extensions"
  subtitle="La Maison d'Adoration pour les Nations est présente dans plusieurs villes. Trouvez l'assemblée la plus proche de chez vous."
/>

<SectionsList page="extensions" emptyText="Les informations sur nos extensions seront bientôt disponibles." />
