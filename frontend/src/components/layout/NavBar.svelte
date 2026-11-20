<script>
  import Container from "./../utils/Container.svelte";
  import get from "lodash.get";
  import config from "../../stores/config";
  import { setToken } from "../../utils/api";
  import { slide, fly } from "svelte/transition";

  let showSideMenu = false;

  // Fond de la barre une fois la page défilée : un simple booléen, qui ne
  // touche au DOM que lorsqu'il change (avant : recherche des éléments et
  // réécriture des classes à chaque événement de défilement).
  let scrollY = 0;
  $: scrolled = scrollY > 40;

  const handleLogout = () => {
    setToken(null);
    config.update((prev) => ({
      ...prev,
      currentUser: null,
    }));
    window.location = "/login";
  };
</script>

<svelte:window bind:scrollY />

<div
  id="header"
  class={`navbar ${scrolled ? "bg-brand-black text-gray-600" : "text-gray-400"} text-sm fixed top-0 left-0 w-full z-50 transition-all duration-250`}
>
  <Container overflowHidden={false}>
    <div
      id="inner-header"
      class="h-16 flex justify-between items-center transition-all duration-250"
    >
      <a class="nav-link flex items-center" href="/#home">
        <img src="/images/man-gold.png" class="w-10 mr-2" alt="home" />
      </a>

      <div class="hidden lg:flex">
        <a class="nav-link mr-6" href="/#home">Accueil</a>
        <a class="nav-link mr-6" href="/maison">Maison</a>
        <a class="nav-link mr-6" href="/ministeres">Ministères</a>
        <a class="nav-link mr-6" href="/extensions">Extensions</a>
        <a class="nav-link mr-6" href="/mediatheque">Médiathèque</a>
        <a class="nav-link mr-6" href="/live">Direct</a>
        <a class="nav-link mr-6" href="/donate">Don en ligne</a>
      </div>

      <div class="">
        <div class="flex items-center justify-center">
          <button
            on:click={() => (showSideMenu = true)}
            class="nav-link flex items-center justify-center"
            aria-label="Ouvrir le menu"
          >
            <ion-icon
              name="menu-outline"
              id="side-menu"
              class={`${scrolled ? "text-gray-600" : "text-gray-100"} text-3xl`}
            ></ion-icon>
          </button>
        </div>
      </div>
    </div>
  </Container>
</div>

{#if showSideMenu}
  <div
    class="fixed top-0 left-0 right-0 bottom-0 h-screen w-screen bg-black/25 z-[3000]"
    role="presentation"
    on:click={() => (showSideMenu = false)}
    transition:fly={{ duration: 100, x: 500 }}
  >
    <div
      class="py-4 px-4 text-sm absolute right-0 top-0 bottom-0 glassmorph-5 w-[85vw] sm:w-[26rem] patterns"
    >
      <div class="grid grid-cols-2 gap-2">
        <a class="nav-link side-btn" href="/#home">
          <ion-icon name="home-outline" class="text-xl mr-2"></ion-icon>
          Accueil
        </a>
        <a class="nav-link side-btn" href="/maison">
          <ion-icon name="information-circle-outline" class="text-xl mr-2"
          ></ion-icon>
          Maison
        </a>

        <a class="nav-link side-btn" href="/ministeres">
          <ion-icon name="people-outline" class="text-xl mr-2"></ion-icon>
          Ministères
        </a>

        <a class="nav-link side-btn" href="/extensions">
          <ion-icon name="location-outline" class="text-xl mr-2"></ion-icon>
          Extensions
        </a>

        <a class="nav-link side-btn" href="/mediatheque">
          <ion-icon name="play-circle-outline" class="text-xl mr-2"></ion-icon>
          Médiathèque
        </a>

        <a class="nav-link side-btn" href="/live">
          <ion-icon name="radio-outline" class="text-xl mr-2"></ion-icon>
          Direct
        </a>

        <a class="nav-link side-btn" href="/#contact">
          <ion-icon name="call-outline" class="text-xl mr-2"></ion-icon>
          Contact
        </a>

        <a class="nav-link side-btn" href="/donate">
          <ion-icon name="heart-circle-outline" class="text-xl mr-2"></ion-icon>
          Don en ligne
        </a>

        <a
          class="nav-link side-btn col-span-full !bg-brand-primary"
          href="/#ressources"
        >
          événements & Ressources
          <ion-icon name="earth-outline" class="text-xl ml-2"></ion-icon>
        </a>

        <div
          class="!text-gray-800 mt-2 h-font font-normal flex items-center text-lg tracking-wider"
        >
          <ion-icon name="planet-outline" class="text-xl mr-2"></ion-icon>
          Connecter:
        </div>

        <div class="col-span-full !w-full grid grid-cols-2 gap-2">
          <a href="/#ressources" class="side-btn-sm side-btn">
            <ion-icon name="headset-outline" class="text-base mr-2"></ion-icon>
            <div class>Podcasts</div>
          </a>
          <a href="/#ressources" class="side-btn-sm side-btn">
            <ion-icon name="mic-circle-outline" class="text-base mr-2"
            ></ion-icon>
            <div class>Sermons</div>
          </a>
          <a
            class="side-btn-sm side-btn"
            href="https://m.facebook.com/search/top?q=%C3%A9cris%20divins%20-%20israel%20kayembe"
            target="_blank"
          >
            <ion-icon name="pencil-outline" class="text-base mr-2"></ion-icon>
            <div class>écris divins</div>
          </a>
          <a
            href="https://www.youtube.com/results?search_query=J%E2%80%99ai+Appris+-+Israel+Kayembe"
            target="_blank"
            class="side-btn-sm side-btn"
          >
            <ion-icon name="bulb-outline" class="text-base mr-2"></ion-icon>
            <div class>J'ai appris</div>
          </a>
          <a
            class="col-span-full side-btn-sm side-btn"
            href="https://m.facebook.com/search/top?q=j%27ai%20appris%20-%20israel%20kayembe"
            target="_blank"
          >
            <ion-icon name="infinite-outline" class="text-base mr-2"></ion-icon>
            <div class>Heures d'intimité</div>
          </a>
        </div>

        {#if ["media", "admin", "super-admin"].includes(get($config, "currentUser.role"))}
          <a
            class="nav-link side-btn col-span-full !bg-brand-primary"
            href="/adm"
          >
            <ion-icon name="settings-outline" class="text-xl mr-2"></ion-icon>
            Admin
          </a>
        {/if}
        {#if get($config, "currentUser.id")}
          <a class="nav-link side-btn" href="/mes-contenus">
            <ion-icon name="library-outline" class="text-xl mr-2"></ion-icon>
            Mes contenus
          </a>
          <a class="nav-link side-btn" href="/profile">
            <ion-icon name="person-circle-outline" class="text-xl mr-2"
            ></ion-icon>
            Profil
          </a>
          <button on:click={handleLogout} class="nav-link side-btn">
            <ion-icon name="log-out-outline" class="text-xl mr-2"></ion-icon>
            Quitter
          </button>
        {:else}
          <a
            class="nav-link side-btn !bg-brand-primary !w-full text-brand-white"
            href="/login"
          >
            Connexion
            <ion-icon name="arrow-forward-circle-outline" class="text-xl ml-2"
            ></ion-icon>
          </a>
          <a class="nav-link side-btn side-btn" href="/register">
            Inscription
            <ion-icon name="create-outline" class="text-xl ml-2"></ion-icon>
          </a>
        {/if}
      </div>
      <div
        class="mt-4 nav-link flex items-center justify-between space-x-2 !text-gray-800"
      >
        <img src="/images/man-gold.png" class="w-10" alt="home" />
        <div class="flex items-center">
          <div class="h-[1px] w-[2.5rem] sm:w-[7rem]"></div>
        </div>
        <a target="_blank" rel="noopener" href="https://www.youtube.com/@mantv6688" aria-label="Chaîne YouTube MAN TV">
          <ion-icon name="logo-youtube" class="text-xl"></ion-icon>
        </a>
        <a target="_blank" rel="noopener" href="https://coachisraelkayembe.com" aria-label="Site du Prophète Israel Kayembe">
          <ion-icon name="globe-outline" class="text-xl"></ion-icon>
        </a>
        <a target="_blank" rel="noopener" href="https://www.instagram.com/maisondadoration_man" aria-label="Instagram">
          <ion-icon name="logo-instagram" class="text-xl"></ion-icon>
        </a>
        <a
          target="_blank"
          rel="noopener"
          href="https://web.facebook.com/Maisondadorationpourlesnations"
          aria-label="Facebook"
        >
          <ion-icon name="logo-facebook" class="text-xl"></ion-icon>
        </a>
      </div>
    </div>
  </div>
{/if}

<style>
  .patterns {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23000000' fill-opacity='0.085' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E");
  }
</style>
