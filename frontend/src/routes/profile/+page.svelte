<script>
  import config from "../../stores/config";
  import api, { errorMessage, setToken, getToken } from "../../utils/api";
  import { onMount } from "svelte";
  import countries from "../../stores/countries";
  import { countryOptions } from "../../utils/countryOptions";
  import MemberHeader from "../../components/member/MemberHeader.svelte";
  import Field from "../../components/auth/Field.svelte";
  import FormAlert from "../../components/auth/FormAlert.svelte";
  import PushToggle from "../../components/shared/PushToggle.svelte";

  let profile = null;
  let saving = false;
  let infoMsg = { text: "", kind: "success" };
  let infoErrors = {};

  let currentPassword = "";
  let newPassword = "";
  let pwdSaving = false;
  let pwdMsg = { text: "", kind: "success" };
  let pwdErrors = {};

  $: options = countryOptions($countries);

  onMount(async () => {
    // Sans jeton, inutile d'interroger l'API : direction la connexion.
    if (!getToken()) return (window.location = "/login");
    try {
      const me = (await api.get("/auth/me")).data;
      profile = { ...me, tel: me.tel || "", country: typeof me.country === "object" && me.country ? me.country.value : me.country || "" };
    } catch {
      window.location = "/login";
    }
  });

  const saveInfo = async () => {
    infoMsg = { text: "" };
    infoErrors = { name: profile.name.trim().length >= 2 ? "" : "Saisissez votre nom complet." };
    if (infoErrors.name) return;
    saving = true;
    try {
      // Seuls ces champs peuvent être modifiés.
      await api.put(`/users/${profile.id}`, {
        name: profile.name.trim(),
        tel: profile.tel.trim(),
        country: profile.country || "",
        emailOptIn: profile.emailOptIn,
        smsOptIn: profile.smsOptIn,
      });
      config.update((c) => ({ ...c, currentUser: { ...c.currentUser, name: profile.name.trim() } }));
      infoMsg = { text: "Modifications enregistrées.", kind: "success" };
    } catch (err) {
      infoMsg = { text: errorMessage(err, "Les modifications n'ont pas été enregistrées. Réessayez."), kind: "error" };
    } finally {
      saving = false;
    }
  };

  const savePassword = async () => {
    pwdMsg = { text: "" };
    pwdErrors = {
      current: currentPassword ? "" : "Saisissez votre mot de passe actuel.",
      next: newPassword.length >= 8 ? "" : "Choisissez un mot de passe d'au moins 8 caractères.",
    };
    if (pwdErrors.current || pwdErrors.next) return;
    pwdSaving = true;
    try {
      const res = await api.put(`/users/${profile.id}/password`, { currentPassword, newPassword });
      setToken(res.data.token); // cet appareil reste connecté ; les autres sont déconnectés
      currentPassword = newPassword = "";
      pwdMsg = { text: "Mot de passe changé. Vos autres appareils ont été déconnectés.", kind: "success" };
    } catch (err) {
      pwdMsg = { text: errorMessage(err, "Mot de passe actuel incorrect. Vérifiez-le et réessayez."), kind: "error" };
    } finally {
      pwdSaving = false;
    }
  };
</script>

<svelte:head>
  <title>Mon profil - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<MemberHeader />

<div class="on-light bg-[#F3F6FA] min-h-[60vh] py-10 md:py-14">
  <div class="max-w-[1040px] mx-auto px-5 md:px-10 grid gap-6">
    {#if profile === null}
      <div class="grid gap-6" aria-busy="true" aria-label="Chargement du profil">
        {#each [0, 1] as _}<div class="h-[320px] rounded-[26px] bg-white animate-pulse"></div>{/each}
      </div>
    {:else}
      <section class="rounded-[26px] bg-white p-6 md:p-9" aria-labelledby="t-infos">
        <h2 id="t-infos" class="font-slab font-bold text-[26px] text-man-nuit">Mes informations</h2>
        <form on:submit|preventDefault={saveInfo} novalidate class="mt-6 grid gap-5">
          <div class="grid md:grid-cols-2 gap-5 [&>*]:min-w-0">
            <Field light label="Nom complet" name="p-name" autocomplete="name" bind:value={profile.name} error={infoErrors.name} required maxlength={120} />
            <Field light label="Téléphone" name="p-tel" type="tel" autocomplete="tel" inputmode="tel" bind:value={profile.tel} maxlength={30} />
            <div class="flex flex-col gap-2">
              <label for="p-country" class="text-sm font-bold text-man-nuit">Pays</label>
              <div class="relative">
                <select id="p-country" bind:value={profile.country} autocomplete="country-name" class="man-input appearance-none w-full h-[52px] rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 pr-10 text-man-nuit focus:border-man-marine focus:outline-none">
                  <option value="">Choisir un pays</option>
                  {#each options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
                </select>
                <svg class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#4A6285]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <span class="text-sm font-bold text-man-nuit">E-mail</span>
              <p class="h-[52px] flex items-center px-4 rounded-2xl bg-[#EEF2F8] text-[#2B3F5C] truncate">{profile.email}</p>
            </div>
          </div>

          <fieldset class="mt-2">
            <legend class="text-sm font-bold text-man-nuit mb-1">Recevoir les annonces de la Maison</legend>
            <label class="flex items-center gap-3 py-2 cursor-pointer text-[#2B3F5C]">
              <input type="checkbox" bind:checked={profile.emailOptIn} class="w-5 h-5 accent-[#173E6F]" /> Par e-mail
            </label>
            <label class="flex items-center gap-3 py-2 cursor-pointer text-[#2B3F5C]">
              <input type="checkbox" bind:checked={profile.smsOptIn} class="w-5 h-5 accent-[#173E6F]" /> Par SMS
            </label>
          </fieldset>
          <PushToggle />

          <FormAlert light message={infoMsg.text} kind={infoMsg.kind} />
          <button type="submit" class="btn-or self-start" disabled={saving} aria-busy={saving}>{saving ? "Enregistrement…" : "Enregistrer les modifications"}</button>
        </form>
      </section>

      <section class="rounded-[26px] bg-white p-6 md:p-9" aria-labelledby="t-mdp">
        <h2 id="t-mdp" class="font-slab font-bold text-[26px] text-man-nuit">Mot de passe</h2>
        <p class="mt-1 text-[#4A6285]">Le changer déconnecte vos autres appareils.</p>
        <form on:submit|preventDefault={savePassword} novalidate class="mt-6 grid gap-5">
          <div class="grid md:grid-cols-2 gap-5 [&>*]:min-w-0">
            <Field light label="Mot de passe actuel" name="p-current" type="password" autocomplete="current-password" bind:value={currentPassword} error={pwdErrors.current} required maxlength={128} />
            <Field light label="Nouveau mot de passe" name="p-new" type="password" autocomplete="new-password" bind:value={newPassword} error={pwdErrors.next} hint="8 caractères minimum." required maxlength={128} />
          </div>
          <FormAlert light message={pwdMsg.text} kind={pwdMsg.kind} />
          <button type="submit" class="btn-line self-start" disabled={pwdSaving} aria-busy={pwdSaving}>{pwdSaving ? "Changement…" : "Changer le mot de passe"}</button>
        </form>
      </section>
    {/if}
  </div>
</div>
