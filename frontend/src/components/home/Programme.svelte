<script>
  import { reveal } from "../../utils/motion";
  // Programme de la semaine : les rendez-vous défilent seuls, le visiteur peut choisir.
  import { createEventDispatcher } from "svelte";
  import { createAutoplay, swipe } from "../../utils/autoplay";
  import { SERVICES } from "../../utils/schedule";
  import AutoplayControls from "../shared/AutoplayControls.svelte";

  const dispatch = createEventDispatcher();
  const ap = createAutoplay({ count: SERVICES.length, dur: 7, initial: 3 }); // le dimanche d'abord
  $: day = SERVICES[$ap.index];
</script>

<section
  id="programme"
  class="relative min-h-[680px] md:min-h-[760px] overflow-hidden flex items-end bg-man-nuit text-white scroll-mt-16"
  aria-roledescription="carrousel"
  aria-label="Programme de la semaine"
  use:ap.observe
  use:swipe={{ onStart: ap.touch, onEnd: (d) => d && (d > 0 ? ap.next() : ap.prev()) }}
  on:mouseenter={ap.enter}
  on:mouseleave={ap.leave}
  on:focusin={ap.focusIn}
  on:focusout={ap.focusOut}
>
  <div aria-hidden="true" class="absolute inset-0">
    {#each SERVICES as s, i}
      <img
        src={s.img}
        alt=""
        loading="lazy"
        class="man-xfade absolute inset-0 w-full h-full object-cover"
        style="opacity: {i === $ap.index ? 1 : 0}"
      />
    {/each}
  </div>
  <div aria-hidden="true" class="absolute inset-0" style="background: linear-gradient(90deg, rgba(10,27,51,.8) 0%, rgba(10,27,51,.25) 60%, rgba(10,27,51,0) 100%), linear-gradient(0deg, rgba(10,27,51,.85) 0%, rgba(10,27,51,0) 50%)"></div>

  <div class="relative w-full max-w-[1320px] mx-auto px-5 md:px-10 pt-28 pb-14 md:py-28 flex flex-col gap-6 md:gap-8">
    <h2 use:reveal class="font-slab font-bold text-[22px] md:text-[26px] text-man-or">Chaque semaine</h2>
    {#key day.key}
      <div class="man-swap flex flex-col gap-2 max-w-[760px]" aria-live={$ap.live}>
        <span class="font-slab font-bold text-[84px] md:text-[clamp(80px,11vw,150px)] leading-[.85]" style="text-shadow: 0 4px 40px rgba(10,27,51,.5)">{day.hour}</span>
        <span class="font-slab font-bold text-[32px] md:text-[44px] leading-tight">{day.name}</span>
        <span class="text-base md:text-lg leading-relaxed text-man-texte">{day.text}</span>
      </div>
    {/key}
    <div class="flex items-center gap-3 md:gap-5 flex-wrap">
      <AutoplayControls {ap} dots={false} />
      <div role="group" aria-label="Choisir un rendez-vous" class="relative grid grid-cols-4 w-full max-w-[560px] p-1.5 rounded-full bg-man-nuit/60 backdrop-blur-md order-first md:order-none">
        <span aria-hidden="true" class="man-ind absolute top-1.5 bottom-1.5 left-1.5 rounded-full bg-man-or" style="width: calc((100% - 12px) / 4); transform: translateX({$ap.index * 100}%)"></span>
        <span aria-hidden="true" class="man-ind absolute -bottom-3 left-1.5 h-[3px]" style="width: calc((100% - 12px) / 4); transform: translateX({$ap.index * 100}%)">
          <span class="block h-[3px] rounded-full bg-man-or" style="width: {$ap.progress * 100}%; transition: {$ap.t === 0 || !$ap.running ? 'none' : 'width 1000ms linear'}"></span>
        </span>
        {#each SERVICES as s, i}
          <button
            type="button"
            class="relative min-h-[46px] font-extrabold text-[13px] md:text-[15px] transition-colors"
            style="color: {i === $ap.index ? '#0A1B33' : '#FFFFFF'}"
            aria-pressed={i === $ap.index}
            on:click={() => ap.pick(i)}
          >{s.short}</button>
        {/each}
      </div>
      <a
        href="#visite"
        class="btn-or"
        on:click|preventDefault={() => dispatch("plan", day.key === "lun" ? "dim" : day.key)}
      >{day.key === "lun" ? "Planifier ma visite" : `Je viens ${day.short.toLowerCase()}`}</a>
    </div>
  </div>
</section>
