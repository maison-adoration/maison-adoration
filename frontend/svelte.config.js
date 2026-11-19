import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  kit: {
    // Site statique : dossier build/, avec une page de secours pour les adresses inconnues.
    adapter: adapter({ pages: "build", assets: "build", fallback: "404.html", strict: false }),
  },
};
