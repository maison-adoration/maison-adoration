<script>
  import PageHero from "../../components/pages/PageHero.svelte";
  import SectionsList from "../../components/pages/SectionsList.svelte";
  import KidsForm from "../../components/pages/KidsForm.svelte";
</script>

<svelte:head>
  <title>Ministères - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<PageHero image="/images/design/enseignement.jpg"
  title="Nos Ministères"
  subtitle="Enfants, jeunes, sœurs, formation, louange, prière, service : il y a une place pour chacun dans la famille M.A.N."
/>

<SectionsList page="ministeres" showNav>
  <svelte:fragment slot="after" let:section>
    {#if section.slug == "man-kids"}
      <KidsForm />
    {/if}
  </svelte:fragment>
</SectionsList>
