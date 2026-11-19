<script>
  import config from "../../stores/config";
  import api, { setToken, errorMessage } from "../../utils/api";
  import Container from "../../components/utils/Container.svelte";

  // Déjà connecté : retour à l'accueil (dès que le profil est chargé).
  $: if ($config.currentUser) window.location = "/";

  let user = { email: localStorage.getItem("email") || "", password: "" };
  let loading = false;

  const handleLogin = async () => {
    if (!user.email.trim() || !user.password) {
      alert("Veuillez saisir votre e-mail et votre mot de passe.");
      return;
    }
    loading = true;
    try {
      const res = await api.post("/auth/login", {
        email: user.email.trim(),
        password: user.password,
      });
      setToken(res.data.token);
      window.location = "/";
    } catch (err) {
      loading = false;
      alert(errorMessage(err, "E-mail ou mot de passe incorrect."));
    }
  };
</script>

<svelte:head>
  <title>Connexion - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<div class="content">
  <div
    class="h-screen"
    style="background-image: url(/images/faveur-12.jpg); background-size: cover; background-position: center;"
  >
    <div class="overlay h-screen flex items-center justify-center">
      <Container>
        <div
          class="w-full md:w-[25rem] grid grid-cols-1 gap-3 px-4 py-6 rounded-lg bg-brand-black patterns"
        >
          <h1>
            Entrez vos <span class="text-brand-primary">identifiants</span> pour
            vous connecter !
          </h1>

          <input type="email" bind:value={user.email} placeholder="E-mail" autocomplete="email" />

          <input
            type="password"
            bind:value={user.password}
            placeholder="Mot de passe"
            autocomplete="current-password"
            on:keydown={(e) => e.key === "Enter" && handleLogin()}
          />

          {#if !loading}
            <button
              class="btn btn-secondary"
              style="width: 100%;"
              on:click={handleLogin}
            >
              Connexion
              <ion-icon name="lock-open" class="text-xl ml-2"></ion-icon>
            </button>
          {:else}
            <button class="btn btn-secondary animate-pulse !w-full">
              <ion-icon name="hourglass-outline" class="text-xl mr-2"></ion-icon>
              Veuillez Patienter...
            </button>
          {/if}

          <a
            href="/register"
            class="!w-full mt-2 text-center text-brand-primary underline decoration-brand-primary/40 text-xs tracking-wider"
          >
            Pas de compte? Enregistrez-vous ici.
          </a>
        </div>
      </Container>
    </div>
  </div>
</div>

<style>
  .patterns {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cg fill-rule='evenodd'%3E%3Cg id='hexagons' fill='%23000000' fill-opacity='0.015' fill-rule='nonzero'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
  }
</style>
