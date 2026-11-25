<script>
  import { onMount } from "svelte";

  // Effet « lumière » qui suit le pointeur au-dessus des cartes.
  // Les variables CSS ne sont posées que sur la couche d'effet (et une fois
  // par image affichée), pour ne pas redessiner toute la section à chaque mouvement.
  onMount(() => {
    const cardsContainer = document.querySelector(".nouraneCards");
    const nouraneCards = Array.from(document.querySelectorAll(".nouraneCards > .cards__inner:not(.nouraneOverlay) > .nouraneCard"));
    const nouraneOverlay = document.querySelector(".nouraneOverlay");
    const section = document.querySelector(".great-container");
    if (!cardsContainer || !nouraneOverlay || !section) return;

    let frame = 0;
    let lastEvent = null;
    const paint = () => {
      frame = 0;
      const rect = cardsContainer.getBoundingClientRect();
      const x = lastEvent.clientX - rect.left;
      const y = lastEvent.clientY - rect.top;
      nouraneOverlay.style.setProperty("--opacity", "1");
      nouraneOverlay.style.setProperty("--x", `${x}px`);
      nouraneOverlay.style.setProperty("--y", `${y}px`);
    };
    const onMove = (e) => {
      lastEvent = e;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => nouraneOverlay.style.setProperty("--opacity", "0");

    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const i = nouraneCards.indexOf(entry.target);
        const box = entry.borderBoxSize && entry.borderBoxSize[0];
        if (i < 0 || !box || !nouraneOverlay.children[i]) return;
        nouraneOverlay.children[i].style.width = `${box.inlineSize}px`;
        nouraneOverlay.children[i].style.height = `${box.blockSize}px`;
      });
    });

    nouraneOverlay.replaceChildren();
    nouraneCards.forEach((cardEl) => {
      const overlayCard = document.createElement("div");
      overlayCard.classList.add("nouraneCard");
      const cta = document.createElement("div");
      cta.classList.add("nouraneCta");
      cta.textContent = cardEl.lastElementChild ? cardEl.lastElementChild.textContent : "";
      cta.setAttribute("aria-hidden", "true");
      overlayCard.append(cta);
      nouraneOverlay.append(overlayCard);
      observer.observe(cardEl);
    });

    section.addEventListener("pointermove", onMove, { passive: true });
    section.addEventListener("pointerleave", onLeave);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      section.removeEventListener("pointermove", onMove);
      section.removeEventListener("pointerleave", onLeave);
    };
  });
</script>

<div id="services"></div>

<div class="great-container">
  <main class="main flow">
    <h1 class="main__heading">
      Nos Services
      <div class="text-sm mt-4 text-center font-light">
        Nourane Décor mets a votre disposition une variété de services
      </div>
    </h1>
    <div class="main__cards nouraneCards">
      <div class="cards__inner">
        <div class="cards__card nouraneCard">
          <h2 class="card__heading">Events</h2>
          <p class="card__price capitalize">Déco des évènements</p>
          <!-- svelte-ignore a11y-no-redundant-roles -->
          <ul role="list" class="card__bullets flow">
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Enterrement de vie de jeune fille (Bridal Shower)
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Demandes en mariage (Proposals)
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Fêtes d'anniversaire
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Mariages
            </li>
          </ul>
          <a href="/#contact" class="card__cta nouraneCta">Nous Contacter</a>
        </div>

        <div class="cards__card nouraneCard">
          <h2 class="card__heading">In-Design</h2>
          <p class="card__price capitalize">Décoration d'interieur</p>
          <!-- svelte-ignore a11y-no-redundant-roles -->
          <ul role="list" class="card__bullets flow">
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Vente des matériaux de déco maison
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Conseil en arrangement des décos maison
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Accompagnement dans le choix de couleurs pour votre maison
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Et bien plus...
            </li>
          </ul>
          <a href="/#contact" class="card__cta nouraneCta">Nous Contacter</a>
        </div>

        <div class="cards__card nouraneCard">
          <h2 class="card__heading">Protection</h2>
          <p class="card__price capitalize">Vente des équipements E.P.I</p>
          <!-- svelte-ignore a11y-no-redundant-roles -->
          <ul role="list" class="card__bullets flow">
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Jacket safety anti froid
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Chemise de site pour gestionnaire
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Chemise de site pour gestionnaire
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Boots PVC
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Casque PVC
            </li>
            <li class="flex items-start text-[0.9rem]">
              <span class="mt-[0.08rem] items-center justify-center">
                <ion-icon aria-hidden="true"
                  name="checkmark-done-outline"
                  class="text-lg mr-2 text-gray-400"></ion-icon>
              </span>
              Et plus...
            </li>
          </ul>
          <a href="/#contact" class="card__cta nouraneCta">Nous Contacter</a>
        </div>
      </div>

      <div class="nouraneOverlay cards__inner"></div>
    </div>
  </main>
</div>
