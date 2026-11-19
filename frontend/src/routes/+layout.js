// Le site fonctionne entièrement dans le navigateur (pas de rendu serveur) :
// chaque page est générée comme une coquille HTML statique au moment du build,
// ce qui permet de l'héberger sur n'importe quel hébergement statique.
export const ssr = false;
export const prerender = true;
export const trailingSlash = "never";
