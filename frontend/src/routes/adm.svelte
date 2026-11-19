<script>
  import Container from "./../components/utils/Container.svelte";
  import get from "lodash.get";
  import config from "../stores/config";
  import AsAdmin from "../components/index/AsAdmin.svelte";
</script>

<div class="min-h-screen">
  {#if ["admin", "super-admin"].includes(get($config, "currentUser.role"))}
    <Container>
      <AsAdmin />
    </Container>
  {:else}
    <div class="h-screen w-full flex items-center justify-center">
      Accès réservé aux administrateurs
    </div>
  {/if}
</div>
