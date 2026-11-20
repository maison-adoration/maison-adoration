<script>
  import { cdn } from "../../utils/cdn.js";
  export let posterUrl;
  export let title = "";
</script>

<div class="p-[1px] border border-white/20 border-dotted shadow-lg">
  <img src={cdn(posterUrl, 500)} alt={title} loading="lazy" />
</div>
