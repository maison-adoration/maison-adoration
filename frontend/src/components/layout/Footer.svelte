<script>
  import Container from "../utils/Container.svelte";
  import get from "lodash.get";
  import config from "../../stores/config";
</script>

<div
  class="pt-5 pb-[1.25rem] font-light text-gray-500 tracking-wider bg-brand-black"
  id="contact"
>
  <div class="relative">
    <Container>
      <div class="h-font mb-4 text-4xl text-brand-primary">Map du Site</div>
      <div class={`grid gap-3 grid-cols-2 md:grid-cols-3 text-sm`}>
        <a class="nav-link" href="/#home">Accueil</a>
        <a class="nav-link" href="/#about">A Propos</a>
        <a class="nav-link" href="/#ressources">Activités</a>
        <a class="nav-link" href="/#contact">Contact</a>
        <a class="nav-link" href="/#donate">Dons</a>
        <a class="nav-link capitalize" href="/#team">équipe</a>

        {#if get($config, "currentUser.id")}
          <a class="nav-link" href="/profile">Profile</a>
          <a class="nav-link" href="/#about">Programme</a>
        {:else}
          <a class="nav-link" href="/login">Connexion</a>
          <a class="nav-link" href="/register">Inscription</a>
        {/if}

        <div class="md:col-span-2 h-font text-base">&copy;{new Date().getFullYear()}</div>
        <a
          class="md:whitespace-nowrap flex items-center h-font text-base"
          target="_blank"
          href="https://glorykatende.com"
        >
          Design By Glory K.
        </a>

      </div>
    </Container>
  </div>
</div>
