<script>
  import config from "../../stores/config";
  import api, { setToken, errorMessage } from "../../utils/api";
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import AuthShell from "../../components/auth/AuthShell.svelte";
  import Field from "../../components/auth/Field.svelte";
  import FormAlert from "../../components/auth/FormAlert.svelte";

  // Déjà connecté : retour à l'accueil (dès que le profil est chargé).
  $: if (browser && $config.currentUser) window.location = "/";

  let email = "";
  let password = "";
  let errors = {};
  let alertMsg = "";
  let loading = false;

  onMount(() => {
    try {
      email = localStorage.getItem("email") || "";
    } catch {
      /* stockage indisponible */
    }
  });

  const submit = async () => {
    alertMsg = "";
    errors = {
      email: email.trim() ? "" : "Saisissez l'e-mail de votre compte.",
      password: password ? "" : "Saisissez votre mot de passe.",
    };
    if (errors.email || errors.password) return;
    loading = true;
    try {
      const res = await api.post("/auth/login", { email: email.trim(), password });
      setToken(res.data.token);
      try { localStorage.setItem("email", email.trim()); } catch { /* ignoré */ }
      window.location = "/";
    } catch (err) {
      loading = false;
      alertMsg = errorMessage(err, "E-mail ou mot de passe incorrect. Vérifiez-les, ou choisissez « Mot de passe oublié ».");
    }
  };
</script>

<svelte:head>
  <title>Connexion - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<AuthShell title="Connexion" intro="Retrouvez vos enseignements, vos livres et vos dons.">
  <form on:submit|preventDefault={submit} novalidate class="flex flex-col gap-5">
    <FormAlert message={alertMsg} />
    <Field label="E-mail" name="email" type="email" autocomplete="email" inputmode="email" bind:value={email} error={errors.email} required />
    <Field label="Mot de passe" name="password" type="password" autocomplete="current-password" bind:value={password} error={errors.password} required />
    <a href="/mot-de-passe" class="self-start text-[15px] font-bold text-man-ciel hover:underline -mt-1">Mot de passe oublié ?</a>
    <button type="submit" class="btn-or w-full mt-1" disabled={loading} aria-busy={loading}>
      {loading ? "Connexion…" : "Se connecter"}
    </button>
  </form>
  <p class="mt-8 pt-6 border-t border-man-trait text-man-doux">
    Pas encore de compte ? <a href="/register" class="font-bold text-man-or hover:underline">Créer un compte</a>
  </p>
</AuthShell>
