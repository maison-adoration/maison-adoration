<script>
  import PageHero from "../../components/pages/PageHero.svelte";
  import SectionsList from "../../components/pages/SectionsList.svelte";
</script>

<svelte:head>
  <title>La Maison - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero
  title="Notre Maison"
  subtitle="« Ramener les Nations à genoux à la croix par l'Enseignement de la Parole et la Puissance du Saint-Esprit. » — Ésaïe 2 : 2-3"
  image="/images/design/prophete.jpg"
/>

<SectionsList page="maison" showNav />
