<script>
  // Champ de formulaire de la charte : étiquette visible, aide, erreur reliée
  // au champ (aria-describedby), et bouton « Afficher » pour les mots de passe.
  export let label;
  export let value = "";
  export let type = "text";
  export let name = "";
  export let autocomplete = "off";
  export let inputmode = undefined;
  export let placeholder = "";
  export let hint = "";
  export let error = "";
  export let required = false;
  export let optional = false;
  export let prefix = ""; // ex. indicatif téléphonique
  export let light = false; // sur fond clair (espace membre)
  export let maxlength = 200;

  const id = `f-${name || Math.random().toString(36).slice(2, 8)}`;
  let shown = false;
  $: realType = type === "password" && shown ? "text" : type;
  $: describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;

  const onInput = (e) => (value = e.currentTarget.value);
</script>

<div class="flex flex-col gap-2 min-w-0">
  <label for={id} class="text-sm font-bold {light ? 'text-man-nuit' : 'text-man-doux'}">
    {label}{#if optional}<span class="font-normal {light ? 'text-[#4A6285]' : 'text-man-bord'}"> (facultatif)</span>{/if}
  </label>
  <div
    class="field flex items-stretch h-[52px] rounded-2xl border-[1.5px] transition-colors duration-150 {light ? 'bg-white' : 'bg-man-nuit2'} {error ? 'border-[#FF8A7A]' : light ? 'border-[#C9D6E8]' : 'border-man-trait'}"
  >
    {#if prefix}
      <span class="flex items-center pl-4 pr-2 font-bold {light ? 'text-[#4A6285]' : 'text-man-doux'}" aria-hidden="true">{prefix}</span>
    {/if}
    <input
      {id}
      {name}
      type={realType}
      {value}
      on:input={onInput}
      on:blur
      {autocomplete}
      {inputmode}
      {placeholder}
      {required}
      {maxlength}
      aria-invalid={error ? "true" : undefined}
      aria-describedby={describedBy}
      class="man-input flex-1 min-w-0 bg-transparent px-4 {prefix ? '!pl-0' : ''} outline-none {light ? 'text-man-nuit placeholder:text-[#8A9BB5]' : 'text-white placeholder:text-man-bord'}"
    />
    {#if type === "password"}
      <button
        type="button"
        class="px-4 text-sm font-bold {light ? 'text-man-marine' : 'text-man-ciel'} hover:underline"
        aria-pressed={shown}
        aria-controls={id}
        on:click={() => (shown = !shown)}
      >{shown ? "Masquer" : "Afficher"}</button>
    {/if}
  </div>
  {#if hint}<p id="{id}-hint" class="text-sm {light ? 'text-[#4A6285]' : 'text-man-bord'}">{hint}</p>{/if}
  {#if error}<p id="{id}-err" class="text-sm {light ? 'text-[#B3261E]' : 'text-[#FFB4A8]'}">{error}</p>{/if}
</div>

<style>
  /* Le cadre entier porte le focus (bordure + liseré), pas seulement le texte. */
  .field:focus-within { border-color: #4AB0EB; box-shadow: 0 0 0 1px #4AB0EB; }
  :global(.on-light) .field:focus-within { border-color: #173E6F; box-shadow: 0 0 0 1px #173E6F; }
  .field :global(.man-input) { border: 0; box-shadow: none; border-radius: 0; height: 100%; }
  .field :global(.man-input:focus-visible) { outline: none; }
</style>
