<script>
  // Formulaire d'inscription d'un enfant à Man Kids.
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";

  let open = false;
  let sending = false;
  let done = false;
  let form = { parentName: "", parentPhone: "", parentEmail: "", childName: "", childAge: "", notes: "" };

  $: if ($config.currentUser && !form.parentName) {
    form.parentName = $config.currentUser.name || "";
    form.parentPhone = $config.currentUser.tel || "";
    form.parentEmail = $config.currentUser.email || "";
  }

  const submit = async () => {
    if (!form.parentName.trim() || !form.parentPhone.trim() || !form.childName.trim() || form.childAge === "") {
      alert("Veuillez remplir les champs obligatoires (*).");
      return;
    }
    sending = true;
    try {
      await api.post("/kids-registrations", { ...form, childAge: Number(form.childAge) });
      done = true;
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      sending = false;
    }
  };

  const another = () => {
    form = { ...form, childName: "", childAge: "", notes: "" };
    done = false;
  };
</script>

<div class="mt-6 rounded-xl border border-brand-primary/30 bg-brand-black-light p-4">
  {#if done}
    <p class="text-gray-800">
      ✅ Merci ! Votre demande d'inscription a bien été envoyée. L'équipe Man Kids vous contactera.
    </p>
    <button class="mt-3 btn btn-secondary" on:click={another}>Inscrire un autre enfant</button>
  {:else if !open}
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="text-gray-700">Vous souhaitez inscrire votre enfant à Man Kids ?</div>
      <button class="btn btn-secondary" on:click={() => (open = true)}>
        Inscrire mon enfant
        <ion-icon name="happy-outline" class="text-xl ml-2"></ion-icon>
      </button>
    </div>
  {:else}
    <form on:submit|preventDefault={submit} class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div class="sm:col-span-2 h-font text-2xl text-brand-primary">Inscription Man Kids</div>
      <input bind:value={form.childName} placeholder="Prénom de l'enfant *" maxlength="120" />
      <input bind:value={form.childAge} type="number" min="0" max="17" placeholder="Âge de l'enfant *" />
      <input bind:value={form.parentName} placeholder="Nom du parent *" maxlength="120" />
      <input bind:value={form.parentPhone} type="tel" placeholder="Téléphone du parent *" />
      <input bind:value={form.parentEmail} type="email" placeholder="E-mail du parent (facultatif)" class="sm:col-span-2" />
      <textarea bind:value={form.notes} rows="3" maxlength="1000" class="sm:col-span-2"
        placeholder="Informations utiles (allergies, besoins particuliers…) — facultatif" />
      <div class="sm:col-span-2 flex gap-3">
        <button type="submit" class="btn btn-secondary !w-full" disabled={sending}>
          {sending ? "Envoi..." : "Envoyer la demande"}
        </button>
        <button type="button" class="btn btn-aurora !w-full" on:click={() => (open = false)}>Annuler</button>
      </div>
      <p class="sm:col-span-2 text-xs text-gray-500">
        Ces informations servent uniquement à l'équipe Man Kids pour organiser l'accueil de votre enfant.
      </p>
    </form>
  {/if}
</div>
