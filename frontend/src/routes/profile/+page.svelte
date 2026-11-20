<script>
  import MyProfileHeading from "../../components/MyProfileHeading.svelte";
  import Select from "svelte-select";
  import config from "../../stores/config";
  import api, { errorMessage, setToken, getToken } from "../../utils/api";
  import { onMount } from "svelte";
  import { Circle } from "svelte-loading-spinners";
  import Container from "../../components/utils/Container.svelte";
  import countries from "../../stores/countries";
  import PushToggle from "../../components/shared/PushToggle.svelte";

  let loading = true;
  let profile = null;
  let uploading = false;
  let uploadingPwd = false;
  let currentPassword;
  let newPassword;
  let confirmNewPassword;

  const loadProfile = async () => {
    try {
      const res = await api.get("/auth/me");
      profile = res.data;
      loading = false;
    } catch (err) {
      window.location = "/login";
    }
  };

  const handleSubmit = async () => {
    uploading = true;
    const country =
      profile.country && typeof profile.country === "object"
        ? profile.country.value
        : profile.country;
    try {
      // Seuls ces champs peuvent être modifiés.
      await api.put(`/users/${profile.id}`, {
        name: profile.name,
        tel: profile.tel || "",
        country: country || "",
        emailOptIn: profile.emailOptIn,
        smsOptIn: profile.smsOptIn,
      });
      alert("✅ Fait !");
      window.location.reload();
    } catch (err) {
      uploading = false;
      alert(errorMessage(err));
    }
  };

  const handleSubmitNewPwd = async () => {
    if (newPassword != confirmNewPassword) {
      alert("Le nouveau mot de passe et sa confirmation ne sont pas identiques.");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      alert("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    uploadingPwd = true;
    try {
      const res = await api.put(`/users/${profile.id}/password`, { currentPassword, newPassword });
      setToken(res.data.token); // cet appareil reste connecté ; les autres sont déconnectés
      alert("✅ Mot de passe changé ! Vos autres appareils ont été déconnectés.");
      window.location.reload();
    } catch (err) {
      uploadingPwd = false;
      alert(errorMessage(err, "Vérifiez que votre mot de passe actuel est correct."));
    }
  };

  onMount(() => {
    // Sans jeton, inutile d'interroger l'API : direction la connexion.
    if (!getToken()) {
      window.location = "/login";
      return;
    }
    loadProfile();
  });
</script>

<svelte:head>
  <title>Votre Profil - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<MyProfileHeading />

<div class="mt-6 min-h-screen">
  <Container>
    {#if loading}
      <div class="h-52 w-full flex items-center justify-center">
        <Circle size="50" color="#3695cb" unit="px" />
      </div>
    {:else}
      <form
        on:submit|preventDefault={handleSubmit}
        class="grid grid-cols-1 gap-y-4 text-gray-500 pb-8"
      >
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 items-center">
            <div>Votre Region:</div>
            <div class="lg:col-span-2 select-item-1">
              <Select
                placeholder="Votre Region"
                bind:value={profile.country}
                items={$countries.map(({ name }) => name)}
              />
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 items-center">
            <div>Nom Complet:</div>
            <input
              class="lg:col-span-2 shadow-sm placeholder-gray-300"
              type="text"
              bind:value={profile.name}
              placeholder="Nom Complet"
              required
            />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 items-center">
            <div>Telephone:</div>
            <input
              class="lg:col-span-2 shadow-sm placeholder-gray-300"
              type="text"
              bind:value={profile.tel}
              placeholder="telephone"
              required
            />
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 items-center">
            <div>E-mail :</div>
            <input
              class="lg:col-span-2 shadow-sm placeholder-gray-300"
              type="text"
              bind:value={profile.email}
              placeholder="email"
              required
              readonly
            />
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={profile.emailOptIn} />
            Recevoir les annonces par e-mail
          </label>
          <label class="flex items-center gap-2">
            <input type="checkbox" bind:checked={profile.smsOptIn} />
            Recevoir les annonces par SMS
          </label>
        </div>

        <PushToggle />

        {#if uploading}
          <div class="grid grid-cols-1 gap-8">
            <div
              class="flex items-center justify-center btn btn-aurora"
              style="width: 100%;"
            >
              <Circle size="25" color="#3695cb" unit="px" />
              <span class="ml-4 py-2">Veuillez Patienter</span>
            </div>
          </div>
        {:else}
          <button class="btn btn-aurora" style="width: 100%;">
            <ion-icon name="checkmark-circle" class="text-xl mr-2"></ion-icon>
            Sauvegarder
          </button>
        {/if}
      </form>

      <!-- Change Password -->
      <!-- Change Password -->

      <h1 class="mt-12 text-gray-500 text-xl uppercase">
        CHANGER LE MOT DE PASSE
      </h1>

      <form
        on:submit|preventDefault={handleSubmitNewPwd}
        class="mt-8 grid grid-cols-1 gap-y-4 text-gray-500 pb-8"
      >
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 items-center">
            <div>Mot de passe actuel:</div>
            <input
              class="lg:col-span-2 shadow-sm placeholder-gray-300"
              type="password"
              bind:value={currentPassword}
              placeholder="Mot de passe actuel"
              required
            />
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 items-center">
            <div>Nouveau mot de passe:</div>
            <input
              class="lg:col-span-2 shadow-sm placeholder-gray-300"
              type="password"
              bind:value={newPassword}
              placeholder="Nouveau mot de passe"
              required
            />
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-2 items-center">
            <div>Confirmer:</div>
            <input
              class="lg:col-span-2 shadow-sm placeholder-gray-300"
              type="password"
              bind:value={confirmNewPassword}
              placeholder="Confirmer nouveau mot de passe"
              required
            />
          </div>
        </div>

        {#if uploadingPwd}
          <div class="grid grid-cols-1 gap-8">
            <div class="flex items-center justify-center btn btn-aurora">
              <Circle size="25" color="#3695cb" unit="px" />
              <span class="ml-4 py-2">Veuillez Patienter</span>
            </div>
          </div>
        {:else}
          <button class="btn btn-aurora" style="width: 100%;">
            <ion-icon name="checkmark-circle" class="text-xl mr-2"></ion-icon>
            Changer mot de passe
          </button>
        {/if}
      </form>
    {/if}
  </Container>
</div>
