<script>
  import Container from "../../components/utils/Container.svelte";
  import DonateVideo from "../../components/index/sub/DonateVideo.svelte";
  import SectionsList from "../../components/pages/SectionsList.svelte";
</script>

<svelte:head>
  <title>Dons En Ligne - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<DonateVideo />

<div id="how"></div>

<div class="-mt-6 text-center max-w-2xl mx-auto relative z-30">
  Merci de votre générosité. C'est grâce à votre fidélité que nous pouvons voir
  des vies transformées en Christ.
</div>

<SectionsList
  page="dons"
  emptyText="Les coordonnées pour les dons (banque et Mobile Money) seront bientôt affichées ici. En attendant, écrivez-nous à l'adresse ci-dessous."
/>

<Container>
  <div class="text-center pb-10">
    Veuillez envoyer un e-mail à
    <span class="text-brand-primary"> dons@maison-adoration.net </span>
    pour toute question ou préoccupation.
  </div>
</Container>


