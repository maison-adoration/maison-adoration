<script>
  import Container from "../utils/Container.svelte";
</script>

<div class="relative showcase bg-[#111111] contact-bg">
  <div class="hidden md:block absolute bottom-0 left-0 right-0 w-full">
    <img src="/images/wave-haikei-white.svg" class="w-full" alt="pizza" />
  </div>
  <div class="md:hidden absolute bottom-0 left-0 right-0 w-full">
    <img
      src="/images/wave-haikei-white-mobile.svg"
      class="w-full"
      alt="pizza"
    />
  </div>

  <div class="absolute bottom-0 left-0 right-0 w-full">
    <Container>
      <img src="/images/man-gold.png" class="w-[3rem] md:w-[3.5rem]" alt="" />
    </Container>
  </div>

  <div
    class="content flex items-center text-gray-300 min-h-screen pt-14 pb-8 md:pt-0 md:pb-0"
  >
    <Container>
      <div class="mb-2">
        <div class="flex items-center justify-center mb-4">
          <!-- <img src="/fav-white.png" class="h-28 md:h-48" alt="arc" /> -->
          <img src="/images/man-gold.png" class="h-28 md:h-48" alt="arc" />
        </div>

        <div
          class="text-brand-primary h-font text-brand-yellow text-3xl md:text-4xl text-center mb-4 uppercase tracking-widest"
        >
          Maison D'Adoration Pour les Nations.
        </div>

        <div
          class="tracking-widest text-lg mb-4 flex items-center justify-center"
        >
          <div
            class="text-base flex items-center justify-center tracking-wide text-center"
          >
            <!-- « » -->
            Utilisez les informations ci-bas pour nous contacter.
          </div>
        </div>

        <div class="flex justify-center relative z-10">
          <div class="text-gray-200 text-sm md:text-base text-center">
            <a href="tel:+243 970 679 649" class="contact-box !text-gray-300">
              <ion-icon name="call" class="text-2xl mr-2"></ion-icon>
              +243 970 679 649
            </a>
            <a
              href="mailto:maisondadoration@gmail.com"
              class="mt-2 contact-box !text-gray-300"
            >
              <ion-icon name="mail" class="text-2xl mr-2"></ion-icon>
              Envoyer un e-mail
            </a>

            <a
              href="https://api.whatsapp.com/send?phone=243970679649"
              about="_blank"
              class="mt-4 btn btn-aurora !px-12 !py-1 h-[2.75rem] !text-white bg-gradient-to-r to-[#25D366] from-brand-primary"
            >
              <ion-icon name="logo-whatsapp" class="text-xl mr-2"></ion-icon>
              Whatsapp
            </a>
          </div>
        </div>
      </div>
    </Container>
  </div>
</div>

<style>
  .contact-box {
    text-align: center;
    color: #fff;
    display: flex;
    align-items: center;
  }

  .showcase {
    height: 100vh;
    position: relative;
  }

  .contact-bg {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='hexagons' fill='%23ffffff' fill-opacity='0.015' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
</style>
