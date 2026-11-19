<script>
  export let name;
  export let email;
  export let tel = null;
  export let country = null;
  export let enrolledAt = null;
  export let source = null;

  const SOURCE = { purchase: "Achat", manual: "Ajout manuel", migration: "Ancien site" };
</script>

<div
  class="!text-xs bg-white py-1 px-3 rounded-md shadow-sm border border-gray-300/10 grid grid-cols-1 gap-1"
>
  <div class="font-bold">{name}</div>
  <div class="flex items-center">
    <ion-icon name="at-circle" class="text-base text-brand-primary mr-1"></ion-icon>
    {email}
  </div>
  {#if tel}
    <div class="flex items-center">
      <ion-icon name="phone-portrait" class="text-base text-brand-primary mr-1"></ion-icon>
      {tel}
    </div>
  {/if}
  {#if country}
    <div class="flex items-center">
      <ion-icon name="location" class="text-base text-brand-primary mr-1"></ion-icon>
      {country}
    </div>
  {/if}
  {#if enrolledAt}
    <div class="text-gray-500">
      {SOURCE[source] || ""} · {new Date(enrolledAt).toLocaleDateString("fr-FR")}
    </div>
  {/if}
</div>
