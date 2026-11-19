<script>
  import { onMount } from "svelte";
  import config from "../../stores/config";
  import api, { getToken } from "../../utils/api";
  import Container from "../../components/utils/Container.svelte";
  import Loading from "../../components/utils/Loading.svelte";
  import Empty from "../../components/utils/Empty.svelte";
  import MyProfileHeading from "../../components/MyProfileHeading.svelte";
  import ConferenceCardForUsers from "../../components/shared/ConferenceCardForUsers.svelte";
  import PdfCard from "../../components/shared/PDFCard.svelte";

  let contents = null;

  const load = async () => {
    try {
      const res = await api.get("/contents/mine");
      contents = res.data;
    } catch (err) {
      window.location = "/login";
    }
  };

  onMount(() => {
    if (!getToken()) {
      window.location = "/login";
      return;
    }
    load();
  });
</script>

<svelte:head>
  <title>Mes contenus - M.A.N. - Maison D'Adoration Pour les Nations</title>
</svelte:head>

<MyProfileHeading />

<div class="min-h-[60vh] py-8">
  <Container>
    <h1 class="h-font text-4xl text-brand-primary text-center mb-2">Mes contenus</h1>
    <p class="text-center text-gray-500 mb-6">Les enseignements et livres que vous avez achetés ou reçus.</p>

    {#if contents == null}
      <Loading text="Veuillez patienter" />
    {:else}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {#each contents as content (content.id)}
          {#if content.type == "pdf"}
            <PdfCard {...content} isLoggedIn={Boolean($config.currentUser)} />
          {:else}
            <ConferenceCardForUsers {...content} isLoggedIn={Boolean($config.currentUser)} />
          {/if}
        {:else}
          <div class="col-span-full text-center">
            <Empty text="Vous n'avez pas encore de contenu payant." />
            <a href="/#ressources" class="btn btn-secondary mt-4">Découvrir les ressources</a>
          </div>
        {/each}
      </div>
    {/if}
  </Container>
</div>
