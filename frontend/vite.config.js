import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  // Même adresse qu'avant en local : http://localhost
  server: { host: true, port: 80 },
  preview: { host: true, port: 4173 },
});
