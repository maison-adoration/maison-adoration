<script>
  export let posterUrl;
  export let title = "";
</script>

<div class="p-[1px] border border-white/20 border-dotted shadow-lg">
  <img src={posterUrl} alt={title} loading="lazy" />
</div>
