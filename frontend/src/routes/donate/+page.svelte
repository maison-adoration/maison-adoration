<script>
  import Container from "../../components/utils/Container.svelte";
  import PageHero from "../../components/pages/PageHero.svelte";
  import Give from "../../components/home/Give.svelte";
  import SectionsList from "../../components/pages/SectionsList.svelte";
</script>

<svelte:head>
  <title>Dons En Ligne - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero
  image="/images/design/adoration.jpg"
  title="Dons en ligne"
  subtitle="Merci de votre générosité : c'est grâce à votre fidélité que des vies sont transformées en Christ."
/>

<Give />

<SectionsList
  page="dons"
  emptyText="Les coordonnées bancaires seront bientôt affichées ici."
/>

<Container>
  <p class="pb-14 text-[#2B3F5C]">
    Une question sur un don ? Écrivez à
    <a class="font-bold text-man-marine underline" href="mailto:dons@maison-adoration.net">dons@maison-adoration.net</a>.
  </p>
</Container>


