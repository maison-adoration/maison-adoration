<script>
  // Demande de prière : reçue par l'équipe de prière (gestion de l'église).
  import { createEventDispatcher } from "svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";
  import Field from "../auth/Field.svelte";
  import FormAlert from "../auth/FormAlert.svelte";

  export let streamId = null; // demande envoyée pendant un direct
  const dispatch = createEventDispatcher();

  let name = "";
  let phone = "";
  let request = "";
  let wantsCall = false;
  let errors = {};
  let alertMsg = "";
  let busy = false;
  let sent = false;

  $: if ($config.currentUser && !name) {
    name = $config.currentUser.name || "";
    phone = $config.currentUser.tel || "";
  }

  const submit = async () => {
    alertMsg = "";
    errors = {
      name: name.trim().length >= 2 ? "" : "Saisissez votre nom.",
      request: request.trim().length >= 5 ? "" : "Décrivez votre sujet de prière en quelques mots.",
      phone: !wantsCall || /^\+?\d{9,15}$/.test(phone.replace(/[\s-]/g, "")) ? "" : "Saisissez un numéro avec l'indicatif pour être rappelé.",
    };
    if (Object.values(errors).some(Boolean)) return;
    busy = true;
    try {
      await api.post("/prayer-requests", { name: name.trim(), phone: phone.trim(), request: request.trim(), wantsCall, ...(streamId ? { streamId } : {}) });
      sent = true;
      dispatch("sent");
    } catch (err) {
      alertMsg = errorMessage(err, "La demande n'a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      busy = false;
    }
  };
  const again = () => {
    sent = false;
    request = "";
    wantsCall = false;
  };
</script>

<div aria-live="polite">
  {#if sent}
    <div class="man-pop flex gap-4 items-start">
      <span class="w-12 h-12 shrink-0 rounded-full bg-man-or flex items-center justify-center" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A1B33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="man-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      <div>
        <p class="text-[17px] text-man-nuit"><strong>{name.trim().split(" ")[0]}</strong>, votre demande est entre les mains de l'équipe de prière.</p>
        <p class="mt-2 text-[#2B3F5C]">{wantsCall ? "Un membre de l'équipe vous appellera." : "Nous prions avec vous."}</p>
        <button type="button" class="mt-3 min-h-[44px] font-bold text-man-marine underline" on:click={again}>Envoyer une autre demande</button>
      </div>
    </div>
  {:else}
    <form on:submit|preventDefault={submit} novalidate class="grid gap-4">
      <FormAlert light message={alertMsg} />
      <Field light label="Votre nom" name="pr-name" autocomplete="name" bind:value={name} error={errors.name} required maxlength={120} />
      <div class="flex flex-col gap-2">
        <label for="pr-request" class="text-sm font-bold text-man-nuit">Sujet de prière</label>
        <textarea id="pr-request" bind:value={request} rows="4" maxlength="2000" required aria-invalid={errors.request ? "true" : undefined} aria-describedby={errors.request ? "pr-request-err" : "pr-request-hint"}
          class="man-input rounded-2xl border-[1.5px] {errors.request ? 'border-[#B3261E]' : 'border-[#C9D6E8]'} bg-white px-4 py-3 text-man-nuit placeholder:text-[#8A9BB5]"></textarea>
        {#if errors.request}<p id="pr-request-err" class="text-sm font-bold text-[#B3261E]">{errors.request}</p>
        {:else}<p id="pr-request-hint" class="text-sm text-[#4A6285]">Seule l'équipe de prière lit votre demande.</p>{/if}
      </div>
      <label class="flex items-center gap-3 min-h-[44px] text-man-nuit cursor-pointer">
        <input type="checkbox" bind:checked={wantsCall} class="w-5 h-5 accent-[#173E6F]" />
        <span>Je souhaite être appelé par l'équipe de prière</span>
      </label>
      {#if wantsCall}
        <Field light label="Téléphone" name="pr-phone" type="tel" autocomplete="tel" inputmode="tel" bind:value={phone} error={errors.phone} required maxlength={20} />
      {/if}
      <button type="submit" class="btn-or w-full mt-1" disabled={busy} aria-busy={busy}>{busy ? "Envoi…" : "Envoyer ma demande"}</button>
    </form>
  {/if}
</div>
