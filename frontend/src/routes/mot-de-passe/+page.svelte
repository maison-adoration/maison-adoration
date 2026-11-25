<script>
  // Mot de passe oublié : demande du lien (sans jeton) ou choix du nouveau mot de passe (avec ?token=).
  import { onMount } from "svelte";
  import api, { errorMessage, setToken } from "../../utils/api";
  import AuthShell from "../../components/auth/AuthShell.svelte";
  import Field from "../../components/auth/Field.svelte";
  import FormAlert from "../../components/auth/FormAlert.svelte";

  let token = "";
  let email = "";
  let password = "";
  let error = "";
  let alertMsg = "";
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
    alertMsg = "";
    error = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Saisissez l'e-mail de votre compte.";
    if (error) return;
    busy = true;
    try {
      const res = await api.post("/auth/forgot-password", { email: email.trim() });
      state = res.data.emailEnabled ? "sent" : "no-email";
    } catch (err) {
      alertMsg = errorMessage(err, "La demande n'a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      busy = false;
    }
  };

  const reset = async () => {
    alertMsg = "";
    error = password.length >= 8 ? "" : "Choisissez un mot de passe d'au moins 8 caractères.";
    if (error) return;
    busy = true;
    try {
      const res = await api.post("/auth/reset-password", { token, password });
      setToken(res.data.token);
      state = "done";
      setTimeout(() => (window.location = "/"), 1800);
    } catch (err) {
      alertMsg = errorMessage(err, "Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.");
    } finally {
      busy = false;
    }
  };

  $: title = state === "reset" ? "Nouveau mot de passe" : state === "done" ? "C'est fait" : "Mot de passe oublié";
  $: intro =
    state === "ask" ? "Indiquez l'e-mail de votre compte : nous vous enverrons un lien pour en choisir un nouveau."
    : state === "reset" ? "Choisissez le mot de passe que vous utiliserez désormais."
    : "";
</script>

<svelte:head>
  <title>Mot de passe oublié - M.A.N.</title>
</svelte:head>

<AuthShell {title} {intro}>
  <div aria-live="polite">
    {#if state === "ask"}
      <form on:submit|preventDefault={ask} novalidate class="flex flex-col gap-5">
        <FormAlert message={alertMsg} />
        <Field label="E-mail" name="email" type="email" autocomplete="email" inputmode="email" bind:value={email} {error} required />
        <button type="submit" class="btn-or w-full" disabled={busy} aria-busy={busy}>{busy ? "Envoi…" : "Recevoir le lien"}</button>
      </form>
    {:else if state === "sent"}
      <div class="man-pop flex flex-col gap-3">
        <p class="text-lg">Si un compte existe pour <strong>{email.trim()}</strong>, un lien vient d'y être envoyé. Il reste valable 1 heure.</p>
        <p class="text-man-doux">Rien reçu ? Regardez dans les courriers indésirables.</p>
        <button type="button" class="btn-ghost self-start mt-2" on:click={() => (state = "ask")}>Utiliser un autre e-mail</button>
      </div>
    {:else if state === "no-email"}
      <div class="man-pop flex flex-col gap-3">
        <p class="text-lg">L'envoi d'e-mails n'est pas encore activé.</p>
        <p class="text-man-doux">Écrivez-nous sur WhatsApp : un administrateur vous donnera un mot de passe provisoire.</p>
        <a href="https://wa.me/243970679649" target="_blank" rel="noopener" class="btn-or self-start mt-2">Écrire sur WhatsApp</a>
      </div>
    {:else if state === "reset"}
      <form on:submit|preventDefault={reset} novalidate class="flex flex-col gap-5">
        <FormAlert message={alertMsg} />
        <Field label="Nouveau mot de passe" name="password" type="password" autocomplete="new-password" bind:value={password} {error} hint="8 caractères minimum." required maxlength={128} />
        <button type="submit" class="btn-or w-full" disabled={busy} aria-busy={busy}>{busy ? "Enregistrement…" : "Enregistrer le mot de passe"}</button>
      </form>
    {:else}
      <div class="man-pop flex items-center gap-4">
        <span class="w-14 h-14 shrink-0 rounded-full bg-man-or flex items-center justify-center" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A1B33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="man-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <p class="text-lg">Mot de passe changé. Vous êtes connecté, retour à l'accueil…</p>
      </div>
    {/if}
  </div>
  <p class="mt-8 pt-6 border-t border-man-trait">
    <a href="/login" class="font-bold text-man-ciel hover:underline">Retour à la connexion</a>
  </p>
</AuthShell>
