<script>
  // Activation des notifications push (nouveaux contenus, annonces) sur cet appareil.
  import { onMount } from "svelte";
  import config from "../../stores/config";
  import api, { errorMessage } from "../../utils/api";

  let supported = false;
  let state = "unknown"; // unknown | on | off | denied
  let busy = false;

  const urlBase64ToUint8Array = (base64) => {
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  };

  onMount(async () => {
    supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!supported) return;
    if (Notification.permission === "denied") return (state = "denied");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = reg && (await reg.pushManager.getSubscription());
    state = sub ? "on" : "off";
  });

  const enable = async () => {
    const key = $config.settings && $config.settings.vapidPublicKey;
    if (!key) return alert("Les notifications ne sont pas encore configurées sur le serveur.");
    busy = true;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        state = permission === "denied" ? "denied" : "off";
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      await api.post("/push-subscriptions", sub.toJSON());
      state = "on";
    } catch (err) {
      alert(errorMessage(err, "Impossible d'activer les notifications sur cet appareil."));
    } finally {
      busy = false;
    }
  };

  const disable = async () => {
    busy = true;
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) await sub.unsubscribe();
      state = "off";
    } finally {
      busy = false;
    }
  };
</script>

{#if supported && $config.settings && $config.settings.vapidPublicKey}
  <div class="rounded-lg border border-gray-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <div>
      <div class="text-gray-700">Notifications sur cet appareil</div>
      <div class="text-xs text-gray-500">
        {#if state === "on"}
          Activées : vous serez prévenu des nouveaux contenus.
        {:else if state === "denied"}
          Bloquées dans votre navigateur. Autorisez-les dans les réglages du site pour les activer.
        {:else}
          Recevez une alerte quand un nouvel enseignement est publié.
        {/if}
      </div>
    </div>
    {#if state === "on"}
      <button type="button" class="btn btn-aurora" on:click={disable} disabled={busy}>Désactiver</button>
    {:else if state !== "denied"}
      <button type="button" class="btn btn-secondary" on:click={enable} disabled={busy}>
        {busy ? "Activation..." : "Activer"}
        <ion-icon name="notifications-outline" class="text-xl ml-2"></ion-icon>
      </button>
    {/if}
  </div>
{/if}
