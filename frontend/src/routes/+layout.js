// Chaque page est pré-générée en HTML complet au moment du build (prerender) :
// le visiteur voit le texte et la mise en page tout de suite, avant même que
// le JavaScript soit chargé. Les données de l'API (contenus, médias…) arrivent
// ensuite dans le navigateur. Le site reste un simple dossier statique.
// Attention : le code exécuté au chargement d'un composant ne doit pas utiliser
// window, document ou localStorage en dehors de onMount (sinon le build échoue).
export const ssr = true;
export const prerender = true;
export const trailingSlash = "never";
