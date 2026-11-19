<script>
  import SectionHeading from "../utils/SectionHeading.svelte";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";
  import { onMount } from "svelte";
  import api from "../../utils/api";
  import Container from "../utils/Container.svelte";
  import EventCard from "../shared/EventCard.svelte";

  const MAX_EVENTS = 6;

  let events = null;

  const fetchEvents = async () => {
    try {
      const res = await api.get("/contents", { params: { type: "activity", limit: MAX_EVENTS } });
      events = res.data;
    } catch (err) {
      events = [];
    }
  };

  onMount(fetchEvents);
</script>

<div id="events"></div>

<div class="bg-brand-white patterns-2 py-8">
  <Container>
    <SectionHeading
      secondColorClass="text-brand-white-no"
      text1="Ne Manquez"
      text2="Aucun Événement"
      breakWord
    />

    {#if events == null}
      <Loading text="Veuillez Patienter" />
    {:else}
      <div
        class="my-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-center"
      >
        {#each events as event (event.id)}
          <EventCard posterUrl={event.posterUrl} title={event.title} />
        {:else}
          <div class="col-span-full">
            <Empty text="Aucun événement en cours..." />
          </div>
        {/each}
      </div>
    {/if}
  </Container>
</div>

<style>
  .patterns-2 {
    background-image: url("data:image/svg+xml,%3Csvg width='84' height='48' viewBox='0 0 84 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h12v6H0V0zm28 8h12v6H28V8zm14-8h12v6H42V0zm14 0h12v6H56V0zm0 8h12v6H56V8zM42 8h12v6H42V8zm0 16h12v6H42v-6zm14-8h12v6H56v-6zm14 0h12v6H70v-6zm0-16h12v6H70V0zM28 32h12v6H28v-6zM14 16h12v6H14v-6zM0 24h12v6H0v-6zm0 8h12v6H0v-6zm14 0h12v6H14v-6zm14 8h12v6H28v-6zm-14 0h12v6H14v-6zm28 0h12v6H42v-6zm14-8h12v6H56v-6zm0-8h12v6H56v-6zm14 8h12v6H70v-6zm0 8h12v6H70v-6zM14 24h12v6H14v-6zm14-8h12v6H28v-6zM14 8h12v6H14V8zM0 8h12v6H0V8z' fill='%23000000' fill-opacity='0.005' fill-rule='evenodd'/%3E%3C/svg%3E");
  }
</style>
