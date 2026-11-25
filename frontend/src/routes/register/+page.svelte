<script>
  import countries from "../../stores/countries";
  import { countryOptions, DRC } from "../../utils/countryOptions";
  import config from "../../stores/config";
  import api, { setToken, errorMessage } from "../../utils/api";
  import { browser } from "$app/environment";
  import AuthShell from "../../components/auth/AuthShell.svelte";
  import Field from "../../components/auth/Field.svelte";
  import FormAlert from "../../components/auth/FormAlert.svelte";

  // Déjà connecté : retour à l'accueil (dès que le profil est chargé).
  $: if (browser && $config.currentUser) window.location = "/";

  $: options = countryOptions($countries);

  let country = DRC;
  let name = "";
  let email = "";
  let tel = "";
  let password = "";
  let errors = {};
  let alertMsg = "";
  let loading = false;

  $: prefix = (options.find((o) => o.value === country) || {}).prefix || "";

  const validate = () => {
    const digits = tel.replace(/[^\d]/g, "");
    errors = {
      name: name.trim().length >= 2 ? "" : "Saisissez votre nom complet.",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Saisissez une adresse e-mail valide, par exemple nom@gmail.com.",
      tel: digits.length >= 6 ? "" : "Saisissez votre numéro sans l'indicatif, par exemple 970 000 000.",
      password: password.length >= 8 ? "" : "Choisissez un mot de passe d'au moins 8 caractères.",
    };
    return !Object.values(errors).some(Boolean);
  };

  const submit = async () => {
    alertMsg = "";
    if (!validate()) return;
    loading = true;
    try {
      const local = tel.replace(/[^\d]/g, "").replace(/^0+/, "");
      const res = await api.post("/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        tel: `${prefix}${local}`,
        country,
      });
      setToken(res.data.token);
      try { localStorage.setItem("email", email.trim()); } catch { /* ignoré */ }
      window.location = "/mes-contenus?bienvenue=1";
    } catch (err) {
      loading = false;
      alertMsg = errorMessage(err, "Le compte n'a pas pu être créé. Vérifiez votre connexion et réessayez.");
    }
  };
</script>

<svelte:head>
  <title>Créer un compte - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<AuthShell title="Créer un compte" intro="Pour accéder aux enseignements, suivre vos achats et recevoir les annonces de la Maison.">
  <form on:submit|preventDefault={submit} novalidate class="flex flex-col gap-5">
    <FormAlert message={alertMsg} />
    <Field label="Nom complet" name="name" autocomplete="name" bind:value={name} error={errors.name} required maxlength={120} />
    <Field label="E-mail" name="email" type="email" autocomplete="email" inputmode="email" bind:value={email} error={errors.email} required />

    <div class="flex flex-col gap-2">
      <label for="f-country" class="text-sm font-bold text-man-doux">Pays</label>
      <div class="relative">
        <select id="f-country" bind:value={country} autocomplete="country-name" class="man-input appearance-none w-full h-[52px] rounded-2xl bg-man-nuit2 border-[1.5px] border-man-trait px-4 pr-10 text-white focus:border-man-ciel focus:outline-none">
          {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
        </select>
        <svg class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-man-doux" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </div>
    </div>

    <Field label="Téléphone" name="tel" type="tel" autocomplete="tel-national" inputmode="tel" {prefix} bind:value={tel} error={errors.tel} hint="Pour recevoir les annonces par SMS ou WhatsApp." required maxlength={20} />
    <Field label="Mot de passe" name="password" type="password" autocomplete="new-password" bind:value={password} error={errors.password} hint="8 caractères minimum." required maxlength={128} />

    <button type="submit" class="btn-or w-full mt-1" disabled={loading} aria-busy={loading}>
      {loading ? "Création du compte…" : "Créer mon compte"}
    </button>
    <p class="text-sm text-man-bord">
      En créant un compte, vous acceptez notre <a href="/privacy" class="underline hover:text-white">politique de confidentialité</a>.
    </p>
  </form>
  <p class="mt-8 pt-6 border-t border-man-trait text-man-doux">
    Déjà inscrit ? <a href="/login" class="font-bold text-man-or hover:underline">Se connecter</a>
  </p>
</AuthShell>
