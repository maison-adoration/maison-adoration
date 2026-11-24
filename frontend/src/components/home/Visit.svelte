<script>
  import { reveal, slidePill } from "../../utils/motion";
  // Première visite : prénom + jour choisi, enregistré pour l'équipe d'accueil.
  import api, { errorMessage } from "../../utils/api";
  import { SERVICES } from "../../utils/schedule";

  export let day = "dim"; // peut être préchoisi depuis le programme

  const DAYS = SERVICES.filter((s) => ["mer", "ven", "dim"].includes(s.key));
  let name = "";
  let phone = "";
  let state = "form"; // form | sending | done
  let error = "";

  $: chosen = DAYS.find((d) => d.key === day) || DAYS[DAYS.length - 1];

  async function submit() {
    error = "";
    if (name.trim().length < 2) {
      error = "Indiquez votre prénom pour que l'équipe d'accueil vous reconnaisse.";
      return;
    }
    state = "sending";
    try {
      await api.post("/visits", { name: name.trim(), phone: phone.trim(), day });
      state = "done";
    } catch (e) {
      state = "form";
      error = errorMessage(e, "La demande n'a pas pu être envoyée. Réessayez dans un instant.");
    }
  }
</script>

<section id="visite" class="relative overflow-hidden bg-man-nuit text-white">
  <picture>
    <source media="(max-width: 767px)" srcset="/images/design/fideles-800.jpg" />
    <img src="/images/design/fideles.jpg" alt="" loading="lazy" class="absolute inset-0 w-full h-full object-cover opacity-30" />
  </picture>
  <span aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(90deg, #0A1B33 30%, rgba(10,27,51,.55) 100%)"></span>

  <div class="relative max-w-[1240px] mx-auto px-5 md:px-10 py-20 md:py-28 grid md:grid-cols-2 gap-10 md:gap-16 items-center">
    <div>
      <h2 use:reveal class="font-slab font-bold text-[38px] md:text-[clamp(42px,5vw,68px)] leading-none">Venez tel que vous êtes.</h2>
      <p class="mt-5 text-lg leading-relaxed text-man-doux max-w-[460px]">
        Dites-nous quand vous passez : quelqu'un vous attendra à l'entrée pour vous installer et répondre à vos questions.
      </p>
    </div>

    <div class="rounded-[28px] bg-man-nuit2/90 border border-man-trait p-6 md:p-8" aria-live="polite">
      {#if state === "done"}
        <div class="man-pop flex flex-col items-start gap-4 py-4">
          <span class="w-14 h-14 rounded-full bg-man-or flex items-center justify-center" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0A1B33" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path class="man-draw" d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          </span>
          <p class="font-slab font-bold text-[28px] leading-tight">À {chosen.dayName.toLowerCase()}, {name.trim()} !</p>
          <p class="text-man-doux">L'équipe d'accueil vous attend à {chosen.hour}, avenue Kapenda 2094, Lubumbashi.</p>
          <button type="button" class="btn-ghost mt-2" on:click={() => { state = "form"; name = ""; phone = ""; }}>Inscrire une autre personne</button>
        </div>
      {:else}
        <form on:submit|preventDefault={submit} novalidate class="flex flex-col gap-5">
          <fieldset>
            <legend class="text-sm font-bold text-man-doux mb-3">Je viens</legend>
            <div class="grid grid-cols-3 gap-2" use:slidePill={day}>
              {#each DAYS as d}
                <label class="press cursor-pointer">
                  <input type="radio" name="day" value={d.key} bind:group={day} class="sr-only peer" />
                  <span data-on={day === d.key} class="flex flex-col items-center justify-center rounded-2xl border-[1.5px] py-3 transition-colors duration-200 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-man-ciel {day === d.key ? 'border-man-or bg-man-or text-man-nuit' : 'border-man-trait text-white'}">
                    <span class="font-bold">{d.dayName}</span>
                    <span class="text-sm opacity-80">{d.hour}</span>
                  </span>
                </label>
              {/each}
            </div>
          </fieldset>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-man-doux">Votre prénom</span>
            <input bind:value={name} autocomplete="given-name" required maxlength="80" class="h-[52px] rounded-2xl bg-man-nuit border-[1.5px] border-man-trait px-4 text-white placeholder:text-man-bord focus:border-man-ciel focus:outline-none" placeholder="Ex. Grâce" aria-invalid={error ? "true" : undefined} aria-describedby={error ? "visite-err" : undefined} />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-bold text-man-doux">Téléphone <span class="font-normal">(facultatif, pour un rappel WhatsApp)</span></span>
            <input bind:value={phone} type="tel" autocomplete="tel" inputmode="tel" maxlength="20" class="h-[52px] rounded-2xl bg-man-nuit border-[1.5px] border-man-trait px-4 text-white placeholder:text-man-bord focus:border-man-ciel focus:outline-none" placeholder="+243 …" />
          </label>
          {#if error}<p id="visite-err" class="text-sm text-[#FFB4A8]">{error}</p>{/if}
          <button type="submit" class="btn-or w-full" disabled={state === "sending"}>
            {state === "sending" ? "Envoi…" : `Je viens ${chosen.dayName.toLowerCase()}`}
          </button>
        </form>
      {/if}
    </div>
  </div>
</section>
