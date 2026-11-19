<script>
  // Paiement Mobile Money (FlexPay) d'un contenu payant.
  // Le prix est fixé par le serveur ; ici on ne demande que le numéro de téléphone.
  import { createEventDispatcher, onDestroy } from "svelte";
  import Modal from "../utils/Modal.svelte";
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

  const pay = async () => {
    if (!phone.trim()) {
      alert("Veuillez saisir votre numéro Mobile Money.");
      return;
    }
    step = "waiting";
    attempts = 0;
    try {
      const res = await api.post("/payments/flexpay", { contentId, phone: phone.trim() });
      poll(res.data.id);
    } catch (err) {
      step = "failed";
      message = errorMessage(err, "Le paiement n'a pas pu être lancé.");
    }
  };

  const close = () => {
    stopPolling();
    step = "form";
    dispatch("modalClose");
  };

  onDestroy(stopPolling);
</script>

<Modal {show} on:modalClose={close}>
  <div class="text-gray-700 text-sm">
    <div class="h-font text-xl text-brand-primary mb-2">Paiement</div>
    <div class="mb-4">
      « {title} » — <strong>{price} {$config.settings.currency}</strong>
    </div>

    {#if !$config.settings.paymentsEnabled}
      <p>
        Le paiement en ligne n'est pas encore disponible.
        <a href="/#contact" class="underline text-brand-primary" on:click={close}>Contactez-nous</a>
        pour obtenir l'accès.
      </p>
    {:else if step === "form"}
      <label class="block mb-1" for="pay-phone">Numéro Mobile Money (M-Pesa, Orange Money, Airtel Money)</label>
      <input id="pay-phone" type="tel" bind:value={phone} placeholder="+243 9XX XXX XXX" class="w-full mb-3" />
      <button class="btn btn-secondary !w-full" on:click={pay}>
        Payer {price} {$config.settings.currency}
        <ion-icon name="phone-portrait-outline" class="text-xl ml-2"></ion-icon>
      </button>
    {:else if step === "waiting"}
      <p class="animate-pulse">
        📱 Une demande de paiement a été envoyée sur votre téléphone. Validez-la avec votre code secret,
        puis patientez : cette fenêtre se met à jour toute seule.
      </p>
    {:else if step === "success"}
      <p>✅ Paiement confirmé ! Vous avez maintenant accès à ce contenu.</p>
    {:else}
      <p class="mb-3">❌ {message}</p>
      <button class="btn btn-secondary !w-full" on:click={() => (step = "form")}>Réessayer</button>
    {/if}
  </div>
</Modal>
