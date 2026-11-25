<script>
  // Formulaire d'inscription d'un enfant à Man Kids.
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";
  import Field from "../auth/Field.svelte";
  import FormAlert from "../auth/FormAlert.svelte";

  let open = false;
  let sending = false;
  let done = false;
  let errors = {};
  let alertMsg = "";
  let form = { parentName: "", parentPhone: "", parentEmail: "", childName: "", childAge: "", notes: "" };

  $: if ($config.currentUser && !form.parentName) {
    form.parentName = $config.currentUser.name || "";
    form.parentPhone = $config.currentUser.tel || "";
    form.parentEmail = $config.currentUser.email || "";
  }

  const submit = async () => {
    alertMsg = "";
    const age = Number(String(form.childAge).trim());
    errors = {
      childName: form.childName.trim() ? "" : "Saisissez le prénom de l'enfant.",
      childAge: String(form.childAge).trim() !== "" && Number.isInteger(age) && age >= 0 && age <= 17 ? "" : "Indiquez un âge entre 0 et 17 ans.",
      parentName: form.parentName.trim() ? "" : "Saisissez votre nom.",
      parentPhone: form.parentPhone.replace(/[^\d]/g, "").length >= 6 ? "" : "Saisissez un numéro où l'équipe peut vous joindre.",
    };
    if (Object.values(errors).some(Boolean)) return;
    sending = true;
    try {
      await api.post("/kids-registrations", { ...form, childAge: age });
      done = true;
    } catch (err) {
      alertMsg = errorMessage(err, "La demande n'a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      sending = false;
    }
  };

  const another = () => {
    form = { ...form, childName: "", childAge: "", notes: "" };
    errors = {};
    done = false;
  };
</script>

<div class="mt-6 rounded-[22px] bg-[#F3F6FA] p-5 md:p-7" aria-live="polite">
  {#if done}
    <div class="man-pop flex flex-col items-start gap-3">
      <p class="font-slab font-bold text-[22px] text-man-nuit">Demande envoyée</p>
      <p class="text-[#2B3F5C]">L'équipe Man Kids vous appellera pour organiser l'accueil de {form.childName.trim() || "votre enfant"}.</p>
      <button type="button" class="btn-line mt-1" on:click={another}>Inscrire un autre enfant</button>
    </div>
  {:else if !open}
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <p class="text-[17px] text-man-nuit">Vous souhaitez inscrire votre enfant à Man Kids ?</p>
      <button type="button" class="btn-or" on:click={() => (open = true)}>Inscrire mon enfant</button>
    </div>
  {:else}
    <form on:submit|preventDefault={submit} novalidate class="man-pop grid grid-cols-1 sm:grid-cols-2 gap-5">
      <h3 class="sm:col-span-2 font-slab font-bold text-[24px] text-man-nuit">Inscription Man Kids</h3>
      <div class="sm:col-span-2"><FormAlert light message={alertMsg} /></div>
      <Field light label="Prénom de l'enfant" name="k-child" bind:value={form.childName} error={errors.childName} required maxlength={120} />
      <Field light label="Âge de l'enfant" name="k-age" inputmode="numeric" bind:value={form.childAge} error={errors.childAge} hint="En années." required maxlength={2} />
      <Field light label="Nom du parent" name="k-parent" autocomplete="name" bind:value={form.parentName} error={errors.parentName} required maxlength={120} />
      <Field light label="Téléphone du parent" name="k-phone" type="tel" autocomplete="tel" inputmode="tel" bind:value={form.parentPhone} error={errors.parentPhone} required maxlength={30} />
      <div class="sm:col-span-2">
        <Field light label="E-mail du parent" name="k-email" type="email" autocomplete="email" inputmode="email" optional bind:value={form.parentEmail} />
      </div>
      <div class="sm:col-span-2 flex flex-col gap-2">
        <label for="k-notes" class="text-sm font-bold text-man-nuit">Informations utiles <span class="font-normal text-[#4A6285]">(facultatif)</span></label>
        <textarea id="k-notes" bind:value={form.notes} rows="3" maxlength="1000" placeholder="Allergies, besoins particuliers…" class="man-input rounded-2xl bg-white border-[1.5px] border-[#C9D6E8] px-4 py-3 text-man-nuit focus:border-man-marine focus:outline-none"></textarea>
      </div>
      <p class="sm:col-span-2 text-sm text-[#4A6285]">Ces informations servent uniquement à l'équipe Man Kids pour accueillir votre enfant.</p>
      <div class="sm:col-span-2 flex flex-col sm:flex-row gap-3">
        <button type="submit" class="btn-or" disabled={sending} aria-busy={sending}>{sending ? "Envoi…" : "Envoyer la demande"}</button>
        <button type="button" class="btn-line" on:click={() => (open = false)}>Annuler</button>
      </div>
    </form>
  {/if}
</div>
