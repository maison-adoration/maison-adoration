<script>
  import Container from "../utils/Container.svelte";
  // 1, 6, 8, 12
</script>

<div class="pb-16 hidden"></div>

<!-- style="background-image: url(/images/faveur-12.jpg); background-size: cover" -->
<div
  class="hero-bg text-gray-600 relative h-[110vh] min-h-[110vh] md:h-[120vh] md:min-h-[120vh]"
  style="background-image: url(/images/bg-08.jpg); background-size: cover"
>
  <div class="patterns h-[110vh] min-h-[110vh] md:h-[120vh] md:min-h-[120vh]">
    <div
      class="flex items-center bg-black/40 text-gray-300 h-[110vh] min-h-[110vh] md:h-[120vh] md:min-h-[120vh]"
    >
      <div class="-mt-12 md:-mt-8 flex items-center justify-center w-full">
        <Container>
          <div
            class="wrd-container drop-shadow-sm h-font text-[4rem] leading-[4.2rem] md:text-8xl text-center uppercase max-w-5xl mx-auto"
          >
            <span></span>
            <span></span>
            <span></span>
            <span>Bienvenue</span>
            <span></span>
            <span>A La</span>
            <span></span>
            <span class="text-brand-primary"> Maison D'Adoration </span>
            <span></span>
            <span>pour</span>
            <span></span>
            <span>les Nations</span>
          </div>

          <div
            class="wrd-container mt-4 text-center k-font tracking-widest text-lg font-light text-gray-300"
          >
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span>REJOIGNEZ-NOUS EN PERSONNE</span>
            <span>OU EN LIGNE</span>
            <span>TOUS LES DIMANCHES</span>
            <span>à 8h30</span>
          </div>

          <div class="wrd-container mt-5 flex items-center justify-center">
            <span>
              <a
                href="/live"
                class="btn btn-secondary h-font !text-xl !px-10 tracking-widest"
              >
                Voir En Direct
                <ion-icon name="logo-youtube" class="text-3xl ml-2"
                ></ion-icon>
              </a>
            </span>
          </div>
        </Container>
      </div>
    </div>
  </div>

  <div class="hidden md:block absolute bottom-0 left-0 right-0 w-full">
    <img src="/images/wave-haikei-gold.svg" class="w-full" alt="pizza" />
  </div>
  <div class="md:hidden absolute bottom-0 left-0 right-0 w-full">
    <img src="/images/wave-haikei-gold-mobile.svg" class="w-full" alt="pizza" />
  </div>
</div>

<style>
  .patterns {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23ffffff' fill-opacity='0.2' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E");
  }

  /* @media (min-width: 700px) {
    .hero-bg {
      background-position: 0px -150px;
    }
  }
  @media (max-width: 699px) {
    .hero-bg {
      background-position: top;
    }
  } */

  @keyframes scaleDownDesktop {
    from {
      background-size: 175% auto;
    }

    to {
      background-size: 100% auto;
    }
  }

  @keyframes scaleDownMobile {
    from {
      background-size: auto 175%;
    }

    to {
      background-size: auto 100%;
    }
  }

  @media (min-width: 700px) {
    .hero-bg {
      animation: 6s scaleDownDesktop forwards;
      background-position-x: center;
    }
  }
  @media (max-width: 699px) {
    .hero-bg {
      background-position: top;
      animation: 6s scaleDownMobile forwards;
    }
  }
</style>
