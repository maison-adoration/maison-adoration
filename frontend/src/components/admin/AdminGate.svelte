<script>
  // N'affiche son contenu qu'aux rôles autorisés ; sinon un écran « Accès réservé ».
  // (Le serveur vérifie de toute façon chaque action.)
  import get from "lodash.get";
  import config from "../../stores/config";

  export let roles = [];
  export let what = "Cet espace est réservé à l'équipe de la Maison.";
  $: role = get($config, "currentUser.role");
</script>

{#if role && roles.includes(role)}
  <slot />
{:else if !$config.userLoaded}
  <div class="min-h-[70vh] pt-32 flex justify-center" aria-busy="true" aria-label="Chargement">
    <span class="w-10 h-10 rounded-full border-4 border-[#C9D6E8] border-t-man-marine animate-spin" aria-hidden="true"></span>
  </div>
{:else}
  <div class="on-light min-h-[80vh] flex flex-col items-center justify-center gap-4 px-5 pt-24 text-center">
    <h1 class="font-slab font-bold text-[30px] text-man-nuit">Accès réservé</h1>
    <p class="text-[#4A6285] max-w-[440px]">{what}{role ? "" : " Connectez-vous avec le bon compte."}</p>
    {#if role}<a href="/" class="btn-line">Retour à l'accueil</a>{:else}<a href="/login" class="btn-or">Se connecter</a>{/if}
  </div>
{/if}
