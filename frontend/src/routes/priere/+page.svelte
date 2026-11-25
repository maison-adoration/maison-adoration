<script>
  import PageHero from "../../components/pages/PageHero.svelte";
  import PrayerForm from "../../components/media/PrayerForm.svelte";
</script>

<svelte:head>
  <title>Demander la prière - M.A.N. - Maison D'Adoration Pour les Nations</title>
  <meta name="description" content="Envoyez votre sujet de prière à l'équipe de prière de la Maison d'Adoration pour les Nations." />
</svelte:head>

<PageHero
  title="Demander la prière"
  subtitle="« Priez les uns pour les autres. » — Jacques 5 : 16. Notre équipe de prière reçoit chaque demande, pendant les directs et toute la semaine."
  image="/images/design/adoration.jpg"
/>

<div class="on-light bg-white py-12 md:py-16">
  <div class="max-w-[1040px] mx-auto px-5 md:px-10 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 md:gap-14 items-start">
    <div class="text-[17px] leading-relaxed text-[#2B3F5C] flex flex-col gap-4">
      <h2 class="font-slab font-bold text-[28px] md:text-[34px] leading-tight text-man-nuit">Vous n'êtes pas seul</h2>
      <p>Écrivez votre sujet en quelques mots. Il est lu uniquement par l'équipe de prière de la Maison, qui prie pour chaque demande.</p>
      <p>Si vous le souhaitez, un membre de l'équipe vous appelle pour prier avec vous.</p>
      <p>Pendant un culte en direct, utilisez le bouton « Demander la prière » sous la vidéo.</p>
    </div>
    <div class="rounded-[26px] border border-[#E1E8F1] p-6 md:p-8">
      <PrayerForm />
    </div>
  </div>
</div>
