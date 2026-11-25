<script>
  // Inscription à un événement : nom, téléphone, e-mail facultatif, nombre de personnes.
  import { createEventDispatcher } from "svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";
  import Modal from "../utils/Modal.svelte";
  import Field from "../auth/Field.svelte";
  import FormAlert from "../auth/FormAlert.svelte";
  import { when } from "../../utils/events";

  export let event = null; // événement ouvert, ou null
  const dispatch = createEventDispatcher();

  let name = "";
  let phone = "";
  let email = "";
  let seats = 1;
  let errors = {};
  let alertMsg = "";
  let busy = false;
  let done = null;

  // Préremplit avec le compte connecté.
  $: if (event && $config.currentUser && !name) {
    name = $config.currentUser.name || "";
    phone = $config.currentUser.tel || "";
    email = $config.currentUser.email || "";
  }
  $: maxSeats = event && event.seatsLeft != null ? Math.max(1, Math.min(10, event.seatsLeft)) : 10;

  const close = () => {
    dispatch("close", { registered: Boolean(done) });
    done = null;
    alertMsg = "";
    errors = {};
  };

  const submit = async () => {
    alertMsg = "";
    errors = {
      name: name.trim().length >= 2 ? "" : "Saisissez votre nom.",
      phone: /^\+?\d{9,15}$/.test(phone.replace(/[\s-]/g, "")) ? "" : "Saisissez un numéro avec l'indicatif, par exemple +243 970 000 000.",
      email: !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "" : "Adresse e-mail invalide.",
    };
    if (Object.values(errors).some(Boolean)) return;
    busy = true;
    try {
      await api.post(`/events/${event.id}/registrations`, { name: name.trim(), phone: phone.trim(), email: email.trim(), seats });
      done = { seats };
    } catch (err) {
      alertMsg = errorMessage(err, "L'inscription n'a pas pu être envoyée. Réessayez dans un instant.");
    } finally {
      busy = false;
    }
  };
</script>

<Modal show={Boolean(event)} title={done ? "Inscription confirmée" : "S'inscrire"} on:modalClose={close}>
  {#if event}
    <div aria-live="polite">
      {#if done}
        <div class="man-pop flex gap-4 items-start">
          <span class="w-12 h-12 shrink-0 rounded-full bg-man-or flex items-center justify-center" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A1B33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="man-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <div>
            <p class="text-[17px] text-man-nuit">
              {name.trim().split(" ")[0]}, {done.seats > 1 ? `vos ${done.seats} places sont réservées` : "votre place est réservée"} pour <strong>{event.title}</strong>.
            </p>
            <p class="mt-2 text-[#2B3F5C] first-letter:uppercase">{when(event)}{event.location ? `, ${event.location}` : ""}.</p>
          </div>
        </div>
      {:else}
        <p class="font-slab font-bold text-[20px] leading-tight text-man-nuit">{event.title}</p>
        <p class="mt-1 text-[15px] text-[#2B3F5C] first-letter:uppercase">{when(event)}{event.location ? `, ${event.location}` : ""}</p>
        <form on:submit|preventDefault={submit} novalidate class="mt-5 grid gap-4">
          <FormAlert light message={alertMsg} />
          <Field light label="Nom complet" name="ev-name" autocomplete="name" bind:value={name} error={errors.name} required maxlength={120} />
          <Field light label="Téléphone" name="ev-phone" type="tel" autocomplete="tel" inputmode="tel" bind:value={phone} error={errors.phone} hint="Pour vous joindre en cas de changement." required maxlength={20} />
          <Field light label="E-mail" name="ev-email" type="email" autocomplete="email" inputmode="email" optional bind:value={email} error={errors.email} />
          <div class="flex flex-col gap-2">
            <label for="ev-seats" class="text-sm font-bold text-man-nuit">Nombre de personnes</label>
            <div class="flex items-center gap-3">
              <button type="button" class="btn-line !min-h-[48px] !w-12 !px-0 text-xl" aria-label="Une personne de moins" disabled={seats <= 1} on:click={() => (seats = Math.max(1, seats - 1))}>−</button>
              <output id="ev-seats" class="min-w-[2ch] text-center font-slab font-bold text-[26px] text-man-nuit" aria-live="polite">{seats}</output>
              <button type="button" class="btn-line !min-h-[48px] !w-12 !px-0 text-xl" aria-label="Une personne de plus" disabled={seats >= maxSeats} on:click={() => (seats = Math.min(maxSeats, seats + 1))}>+</button>
              <span class="text-sm text-[#4A6285]">vous compris</span>
            </div>
          </div>
          <button type="submit" class="btn-or w-full mt-1" disabled={busy} aria-busy={busy}>{busy ? "Envoi…" : seats > 1 ? `Réserver ${seats} places` : "Réserver ma place"}</button>
        </form>
      {/if}
    </div>
  {/if}
</Modal>
