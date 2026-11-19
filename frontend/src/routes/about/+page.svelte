<script>
  import { onMount } from "svelte";
  // L'ancienne page « À propos » est remplacée par la page Maison.
  onMount(() => window.location.replace("/maison"));
</script>
