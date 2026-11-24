<script>
  import get from "lodash.get";
  import config from "../../stores/config";
</script>

<footer id="contact" class="scroll-mt-16 bg-man-nuit text-man-doux border-t border-man-trait px-5 md:px-10 pt-16 pb-10">
  <div class="max-w-[1240px] mx-auto grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
    <div class="flex items-center gap-4">
      <img src="/images/man-gold.png" alt="Logo M.A.N" class="w-16" width="64" height="64" loading="lazy" />
      <span class="font-slab font-bold text-xl leading-tight text-white">Maison d'Adoration pour les Nations</span>
    </div>
    <div class="flex flex-col gap-1.5 text-[15px]">
      <h2 class="font-extrabold text-man-or mb-2 text-[15px]">Nous rendre visite</h2>
      <span>2094, av. Kapenda, coin Kimbangu</span>
      <span>À côté de l'hôpital chinois Ruichen</span>
      <span>Lubumbashi, Haut-Katanga, RDC</span>
    </div>
    <div class="flex flex-col gap-1 text-[15px]">
      <h2 class="font-extrabold text-man-or mb-2 text-[15px]">Contact</h2>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="tel:+243970679649">+243 970 679 649</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="https://wa.me/243970679649" target="_blank" rel="noopener">WhatsApp</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white break-all" href="mailto:maisondadoration@gmail.com">maisondadoration@gmail.com</a>
    </div>
    <nav aria-label="Pied de page" class="flex flex-col gap-1 text-[15px]">
      <h2 class="font-extrabold text-man-or mb-2 text-[15px]">Explorer</h2>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/">Accueil</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/maison">À propos</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/#programme">Programme</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/ministeres">Ministères</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/extensions">Extensions</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/mediatheque">Médiathèque et direct</a>
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/donate">Don en ligne</a>
      {#if get($config, "currentUser.id")}
        <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/mes-contenus">Mon espace membre</a>
      {:else}
        <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/login">Connexion</a>
      {/if}
      <a class="min-h-[32px] flex items-center text-man-texte hover:text-white" href="/privacy">Confidentialité</a>
    </nav>
  </div>
  <div class="max-w-[1240px] mx-auto mt-12 pt-6 border-t border-man-trait flex flex-wrap justify-between gap-3 text-sm text-[#A9BBD2]">
    <span>© {new Date().getFullYear()} Maison d'Adoration pour les Nations</span>
    <span>« Toutes les nations y afflueront », Ésaïe 2 : 2</span>
  </div>
</footer>
