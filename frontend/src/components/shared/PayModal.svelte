<script>
  // Paiement Mobile Money (FlexPay) d'un contenu payant.
  // Le prix est fixé par le serveur ; ici on ne demande que le numéro de téléphone.
  import { createEventDispatcher, onDestroy } from "svelte";
  import Modal from "../utils/Modal.svelte";
  import Field from "../auth/Field.svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";

  export let show = false;
  export let contentId;
  export let title;
  export let price;

  const dispatch = createEventDispatcher();

  let phone = ($config.currentUser && $config.currentUser.tel) || "";
  let step = "form"; // form | waiting | success | failed
  let message = "";
  let timer = null;
  let attempts = 0;
  const MAX_ATTEMPTS = 36; // 36 × 5 s = 3 minutes

  const stopPolling = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const poll = async (paymentId) => {
    attempts++;
    try {
      const res = await api.get(`/payments/${paymentId}`);
      if (res.data.status === "success") {
        step = "success";
        dispatch("paid");
        return;
      }
      if (res.data.status === "failed") {
        step = "failed";
        message = res.data.message || "Le paiement n'a pas abouti.";
        return;
      }
    } catch (err) {
      /* on réessaie */
    }
    if (attempts >= MAX_ATTEMPTS) {
      step = "failed";
      message =
        "Pas encore de confirmation. Si vous avez validé sur votre téléphone, rechargez la page dans quelques minutes.";
      return;
    }
    timer = setTimeout(() => poll(paymentId), 5000);
  };

  let phoneError = "";
  const pay = async () => {
    phoneError = /^\+?\d{9,15}$/.test(phone.replace(/[\s-]/g, "")) ? "" : "Saisissez le numéro qui recevra la demande, par exemple +243 970 000 000.";
    if (phoneError) return;
    step = "waiting";
    attempts = 0;
    try {
      const res = await api.post("/payments/flexpay", { contentId, phone: phone.trim() });
      poll(res.data.id);
    } catch (err) {
      step = "failed";
      message = errorMessage(err, "Le paiement n'a pas pu être lancé. Vérifiez le numéro et réessayez.");
    }
  };

  const close = () => {
    stopPolling();
    step = "form";
    dispatch("modalClose");
  };

  onDestroy(stopPolling);
</script>

<Modal {show} title="Acheter ce contenu" on:modalClose={close}>
  <div aria-live="polite">
    <p class="text-[17px] text-[#2B3F5C]">
      {title}, <strong class="text-man-nuit">{price} {$config.settings.currency || "USD"}</strong>
    </p>

    {#if !$config.settings.paymentsEnabled}
      <p class="mt-4 text-[#2B3F5C]">
        Le paiement en ligne n'est pas encore ouvert. Écrivez-nous pour obtenir l'accès.
      </p>
      <a href="https://wa.me/243970679649" target="_blank" rel="noopener" class="btn-or w-full mt-4">Écrire sur WhatsApp</a>
    {:else if step === "form"}
      <form on:submit|preventDefault={pay} novalidate class="mt-5 flex flex-col gap-4">
        <Field light label="Numéro Mobile Money" name="pay-phone" type="tel" autocomplete="tel" inputmode="tel" bind:value={phone} error={phoneError} hint="M-Pesa, Orange Money ou Airtel Money. La demande arrive sur ce téléphone." required maxlength={20} />
        <button type="submit" class="btn-or w-full">Payer {price} {$config.settings.currency || "USD"}</button>
      </form>
    {:else if step === "waiting"}
      <div class="mt-5 flex gap-4 items-start">
        <span class="man-live mt-1 w-3 h-3 shrink-0 rounded-full bg-man-or" aria-hidden="true"></span>
        <div>
          <p class="font-bold text-man-nuit">Confirmez sur votre téléphone</p>
          <p class="mt-1 text-[#2B3F5C]">Saisissez votre code Mobile Money pour valider. Cette fenêtre se met à jour toute seule.</p>
        </div>
      </div>
    {:else if step === "success"}
      <div class="man-pop mt-5 flex gap-4 items-center">
        <span class="w-12 h-12 shrink-0 rounded-full bg-man-or flex items-center justify-center" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0A1B33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="man-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </span>
        <p class="text-[17px] text-man-nuit">Paiement confirmé. Le contenu est maintenant dans « Mes contenus ».</p>
      </div>
    {:else}
      <p class="mt-5 rounded-2xl border-l-4 border-[#B3261E] bg-[#FDECEA] px-4 py-3 text-[#7A1A14]">{message}</p>
      <button type="button" class="btn-or w-full mt-4" on:click={() => (step = "form")}>Réessayer</button>
    {/if}
  </div>
</Modal>
