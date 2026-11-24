<script>
  import { reveal, slidePill } from "../../utils/motion";
  // Don par Mobile Money (FlexPay), sans compte. Le statut est suivi avec un jeton
  // propre à ce don, jusqu'à la confirmation sur le téléphone.
  import { onDestroy } from "svelte";
  import api, { errorMessage } from "../../utils/api";

  const KINDS = [
    { key: "dime", label: "Dîme" },
    { key: "offrande", label: "Offrande" },
    { key: "projet", label: "Projet de construction" },
  ];
  const AMOUNTS = [5, 10, 20, 50, 100];

  let kind = "offrande";
  let preset = 20;
  let custom = "";
  let phone = "";
  let name = "";
  let state = "form"; // form | sending | waiting | success | failed
  let error = "";
  let payment = null;
  let timer;

  $: amount = preset === "autre" ? Number(String(custom).replace(",", ".")) : preset;
  $: kindLabel = (KINDS.find((k) => k.key === kind) || KINDS[1]).label;

  async function submit() {
    error = "";
    if (!amount || amount < 1) return (error = "Choisissez un montant d'au moins 1 $.");
    if (!/^\+?\d{9,15}$/.test(phone.replace(/[\s-]/g, ""))) return (error = "Entrez le numéro Mobile Money qui recevra la demande (ex. +243 97…).");
    state = "sending";
    try {
      const res = await api.post("/payments/donation", { kind, amount, phone, name: name.trim() });
      payment = res.data;
      state = "waiting";
      poll(0);
    } catch (e) {
      state = "form";
      error = e?.response?.status === 503
        ? "Le don en ligne n'est pas encore ouvert. Vous pouvez donner au culte ou nous écrire sur WhatsApp."
        : errorMessage(e, "La demande n'a pas pu être envoyée. Vérifiez le numéro et réessayez.");
    }
  }

  function poll(n) {
    clearTimeout(timer);
    if (n > 60) return; // ~5 min : on laisse l'écran d'attente avec son conseil
    timer = setTimeout(async () => {
      try {
        const res = await api.get(`/payments/donation/${payment.id}`, { params: { token: payment.token } });
        const st = res.data.status;
        if (st === "success") return (state = "success");
        if (st === "failed") { payment.message = res.data.message; return (state = "failed"); }
      } catch (e) { /* réseau instable : on réessaie */ }
      poll(n + 1);
    }, n < 6 ? 3000 : 6000);
  }

  function reset() {
    clearTimeout(timer);
    state = "form";
    payment = null;
  }
  onDestroy(() => clearTimeout(timer));
</script>

<section id="don" class="relative overflow-hidden bg-man-nuit2 text-white">
  <div aria-hidden="true" class="absolute -right-40 -top-40 w-[560px] h-[560px] rounded-full" style="background: radial-gradient(circle, rgba(228,190,5,.16) 0%, rgba(228,190,5,0) 65%)"></div>
  <div class="relative max-w-[1240px] mx-auto px-5 md:px-10 py-20 md:py-28 grid md:grid-cols-[1fr_1.1fr] gap-10 md:gap-16 items-start">
    <div>
      <h2 use:reveal class="font-slab font-bold text-[38px] md:text-[clamp(42px,5vw,68px)] leading-none">Semer dans la Maison.</h2>
      <p class="mt-5 text-lg leading-relaxed text-man-doux max-w-[440px]">
        Votre dîme et vos offrandes soutiennent les cultes, les écoles et la construction du sanctuaire. Le paiement se confirme sur votre téléphone.
      </p>
      <p class="mt-6 text-man-or font-slab text-xl">« Dieu aime celui qui donne avec joie. »</p>
      <p class="text-sm text-man-bord mt-1">2 Corinthiens 9:7</p>
    </div>

    <div class="rounded-[28px] bg-man-nuit border border-man-trait p-6 md:p-8" aria-live="polite">
      {#if state === "waiting"}
        <div class="man-pop flex flex-col items-start gap-4 py-2">
          <span class="man-live w-14 h-14 rounded-full border-2 border-man-or flex items-center justify-center" aria-hidden="true">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E4BE05" stroke-width="2" stroke-linecap="round"><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></svg>
          </span>
          <p class="font-slab font-bold text-[26px] leading-tight">Confirmez sur votre téléphone</p>
          <p class="text-man-doux">Une demande de {payment.amount} {payment.currency} vient d'être envoyée au {phone}. Saisissez votre code Mobile Money pour valider.</p>
          <p class="text-sm text-man-bord">Rien reçu après une minute ? Vérifiez le numéro, puis recommencez.</p>
          <button type="button" class="btn-ghost" on:click={reset}>Recommencer</button>
        </div>
      {:else if state === "success"}
        <div class="man-pop flex flex-col items-start gap-4 py-2">
          <span class="w-14 h-14 rounded-full bg-man-or flex items-center justify-center" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A1B33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="man-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <p class="font-slab font-bold text-[28px] leading-tight">Merci{name.trim() ? `, ${name.trim()}` : ""} !</p>
          <p class="text-man-doux">Votre {kindLabel.toLowerCase()} de {payment.amount} {payment.currency} a bien été reçue. Que Dieu vous bénisse.</p>
          <button type="button" class="btn-ghost" on:click={reset}>Faire un autre don</button>
        </div>
      {:else if state === "failed"}
        <div class="man-pop flex flex-col items-start gap-4 py-2">
          <p class="font-slab font-bold text-[26px] leading-tight">Le paiement n'a pas abouti</p>
          <p class="text-man-doux">{payment.message || "La demande a été refusée ou a expiré. Aucun montant n'a été prélevé."}</p>
          <button type="button" class="btn-or" on:click={reset}>Réessayer</button>
        </div>
      {:else}
        <form on:submit|preventDefault={submit} novalidate class="flex flex-col gap-5">
          <fieldset>
            <legend class="text-sm font-bold text-man-doux mb-3">Je donne pour</legend>
            <div class="flex flex-wrap gap-2" use:slidePill={kind}>
              {#each KINDS as k}
                <label class="press cursor-pointer">
                  <input type="radio" name="kind" value={k.key} bind:group={kind} class="sr-only peer" />
                  <span data-on={kind === k.key} class="inline-flex items-center min-h-[44px] px-4 rounded-full border-[1.5px] font-bold transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-man-ciel {kind === k.key ? 'border-man-or bg-man-or text-man-nuit' : 'border-man-trait'}">{k.label}</span>
                </label>
              {/each}
            </div>
          </fieldset>
          <fieldset>
            <legend class="text-sm font-bold text-man-doux mb-3">Montant (USD)</legend>
            <div class="grid grid-cols-3 sm:grid-cols-6 gap-2" use:slidePill={preset}>
              {#each [...AMOUNTS, "autre"] as a}
                <label class="press cursor-pointer">
                  <input type="radio" name="amount" value={a} bind:group={preset} class="sr-only peer" />
                  <span data-on={preset === a} class="flex items-center justify-center h-12 rounded-2xl border-[1.5px] font-bold transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-man-ciel {preset === a ? 'border-man-or bg-man-or text-man-nuit' : 'border-man-trait'}">{a === "autre" ? "Autre" : `${a} $`}</span>
                </label>
              {/each}
            </div>
            {#if preset === "autre"}
              <input bind:value={custom} inputmode="decimal" aria-label="Autre montant en dollars" placeholder="Montant en $" class="man-pop mt-3 w-full h-[52px] rounded-2xl bg-man-nuit2 border-[1.5px] border-man-trait px-4 text-white placeholder:text-man-bord focus:border-man-ciel focus:outline-none" />
            {/if}
          </fieldset>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-man-doux">Numéro Mobile Money <span class="font-normal">(M-Pesa, Orange, Airtel)</span></span>
            <input bind:value={phone} type="tel" autocomplete="tel" inputmode="tel" maxlength="20" placeholder="+243 97…" class="h-[52px] rounded-2xl bg-man-nuit2 border-[1.5px] border-man-trait px-4 text-white placeholder:text-man-bord focus:border-man-ciel focus:outline-none" aria-invalid={error ? "true" : undefined} aria-describedby={error ? "don-err" : undefined} />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-man-doux">Votre nom <span class="font-normal">(facultatif)</span></span>
            <input bind:value={name} autocomplete="name" maxlength="120" class="h-[52px] rounded-2xl bg-man-nuit2 border-[1.5px] border-man-trait px-4 text-white focus:border-man-ciel focus:outline-none" />
          </label>
          {#if error}<p id="don-err" class="text-sm text-[#FFB4A8]">{error}</p>{/if}
          <button type="submit" class="btn-or w-full" disabled={state === "sending"}>
            {state === "sending" ? "Envoi de la demande…" : amount >= 1 ? `Donner ${amount} $` : "Donner"}
          </button>
        </form>
      {/if}
    </div>
  </div>
</section>
