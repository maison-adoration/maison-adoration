<script>
  // Mot de passe oublié : demande du lien (sans jeton) ou choix du nouveau mot de passe (avec ?token=).
  import { onMount } from "svelte";
  import api, { errorMessage, setToken } from "../../utils/api";
  import Container from "../../components/utils/Container.svelte";

  let token = "";
  let email = "";
  let password = "";
  let confirm = "";
  let busy = false;
  let state = "ask"; // ask | sent | no-email | reset | done

  onMount(() => {
    token = new URLSearchParams(location.search).get("token") || "";
    if (token) {
      state = "reset";
      // Le jeton ne reste pas dans l'historique du navigateur.
      history.replaceState(null, "", "/mot-de-passe");
    }
  });

  const ask = async () => {
    if (!email.trim()) return alert("Veuillez saisir votre e-mail.");
    busy = true;
    try {
      const res = await api.post("/auth/forgot-password", { email: email.trim() });
      state = res.data.emailEnabled ? "sent" : "no-email";
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      busy = false;
    }
  };

  const reset = async () => {
    if (password.length < 8) return alert("Le mot de passe doit contenir au moins 8 caractères.");
    if (password !== confirm) return alert("Les deux mots de passe ne sont pas identiques.");
    busy = true;
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      setToken(res.data.token);
      state = "done";
      setTimeout(() => (window.location = "/"), 1500);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      busy = false;
    }
  };
</script>

<svelte:head>
  <title>Mot de passe oublié - M.A.N.</title>
</svelte:head>

<div class="min-h-screen pt-28 pb-16 bg-[#111111] text-gray-300">
  <Container>
    <div class="max-w-md mx-auto rounded-xl bg-white text-gray-800 p-6 shadow-lg">
      <h1 class="h-font text-3xl text-brand-primary mb-4">Mot de passe oublié</h1>

      {#if state === "ask"}
        <form on:submit|preventDefault={ask} class="grid gap-3">
          <p class="text-sm text-gray-600">Saisissez l'e-mail de votre compte : nous vous enverrons un lien pour choisir un nouveau mot de passe.</p>
          <input type="email" bind:value={email} placeholder="E-mail" autocomplete="email" />
          <button type="submit" class="btn btn-secondary !w-full" disabled={busy}>{busy ? "Envoi..." : "Recevoir le lien"}</button>
        </form>
      {:else if state === "sent"}
        <p>📧 Si un compte existe avec cet e-mail, un lien vient d'y être envoyé. Il est valable 1 heure.</p>
        <p class="text-sm text-gray-500 mt-2">Pensez à regarder dans les courriers indésirables.</p>
      {:else if state === "no-email"}
        <p>L'envoi d'e-mails n'est pas encore activé sur le site.</p>
        <p class="mt-2">
          Contactez l'église (<a class="underline text-brand-primary" href="/#contact">page Contact</a>) :
          un administrateur peut vous donner un mot de passe provisoire.
        </p>
      {:else if state === "reset"}
        <form on:submit|preventDefault={reset} class="grid gap-3">
          <input type="password" bind:value={password} placeholder="Nouveau mot de passe (8 caractères min.)" autocomplete="new-password" />
          <input type="password" bind:value={confirm} placeholder="Confirmer le mot de passe" autocomplete="new-password" />
          <button type="submit" class="btn btn-secondary !w-full" disabled={busy}>{busy ? "Enregistrement..." : "Enregistrer"}</button>
        </form>
      {:else}
        <p>✅ Mot de passe changé, vous êtes connecté. Redirection…</p>
      {/if}

      <a href="/login" class="block mt-5 text-sm text-gray-500 underline">← Retour à la connexion</a>
    </div>
  </Container>
</div>
