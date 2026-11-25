<script>
  // Suivi des paiements Mobile Money : liste, filtres, totaux, export Excel.
  import { onMount } from "svelte";
  import api, { errorMessage } from "../../utils/api";
  import Loading from "../utils/Loading.svelte";
  import Empty from "../utils/Empty.svelte";

  const STATUS = { success: "Réussi", pending: "En attente", failed: "Échoué" };
  let status = "";
  let purpose = "";
  let search = "";
  let from = "";
  let to = "";
  let data = null;
  let exporting = false;

  const params = () => ({
    ...(status ? { status } : {}),
    ...(purpose ? { purpose } : {}),
    ...(search ? { search } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  });

  const load = async () => {
    data = null;
    try {
      data = (await api.get("/payments", { params: params() })).data;
    } catch (err) {
      data = { payments: [], totals: [] };
      alert(errorMessage(err));
    }
  };

  const exportCsv = async () => {
    exporting = true;
    try {
      const res = await api.get("/payments", { params: { ...params(), format: "xlsx" }, responseType: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(res.data);
      link.download = `${purpose === "donation" ? "dons" : purpose === "content" ? "achats" : "dons-et-paiements"}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      alert(errorMessage(err));
    } finally {
      exporting = false;
    }
  };

  const when = (d) => new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
  onMount(load);
</script>

<div class="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
  <input class="md:col-span-2" bind:value={search} placeholder="Nom, e-mail, téléphone, contenu ou donateur"
    on:keydown={(e) => e.key == "Enter" && load()} />
  <select bind:value={status} on:change={load} aria-label="Statut du paiement">
    <option value="">Tous les statuts</option>
    <option value="success">Réussis</option>
    <option value="pending">En attente</option>
    <option value="failed">Échoués</option>
  </select>
  <select bind:value={purpose} on:change={load} aria-label="Type de paiement">
    <option value="">Contenus et dons</option>
    <option value="content">Achats de contenus</option>
    <option value="donation">Dons</option>
  </select>
  <label class="text-xs text-gray-600">Du <input type="date" bind:value={from} on:change={load} /></label>
  <label class="text-xs text-gray-600">Au <input type="date" bind:value={to} on:change={load} /></label>
</div>
<div class="flex flex-wrap gap-2 mb-4">
  <button class="btn btn-secondary" on:click={load}>Rechercher</button>
  <button class="btn btn-aurora" on:click={exportCsv} disabled={exporting}>{exporting ? "Préparation..." : "Exporter en Excel"}</button>
</div>

{#if data == null}
  <Loading text="Veuillez patienter" />
{:else}
  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
    {#each data.totals as t}
      <div class="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div class="text-xs uppercase tracking-wider text-gray-600">Encaissé ({t.currency})</div>
        <div class="text-3xl text-brand-primary h-font">{Number(t.total).toLocaleString("fr-FR")} {t.currency}</div>
        <div class="text-xs text-gray-600">{t.successes} réussi(s) · {t.pending} en attente · {t.failed} échoué(s)</div>
      </div>
    {:else}
      <div class="text-sm text-gray-600">Aucun paiement sur cette période.</div>
    {/each}
  </div>

  <div class="grid grid-cols-1 gap-2">
    {#each data.payments as p (p.id)}
      <div class="flex flex-col md:flex-row md:items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 text-sm">
        <div class="flex-1">
          <div class="font-bold text-gray-800">{p.content_title}</div>
          <div class="text-gray-600">{p.payer_name || (p.donation_kind ? "Donateur anonyme" : "Compte supprimé")} · {p.payer_email || "—"} · {p.phone}</div>
          <div class="text-xs text-gray-600">{when(p.created_at)} · réf. {p.reference}{p.message ? ` · ${p.message}` : ""}</div>
        </div>
        <div class="text-right">
          <div class="font-bold">{p.amount} {p.currency}</div>
          <div class="text-xs" class:text-green-700={p.status == "success"} class:text-orange-700={p.status == "pending"} class:text-red-600={p.status == "failed"}>
            {STATUS[p.status]}
          </div>
        </div>
      </div>
    {:else}
      <Empty text="Aucun paiement" />
    {/each}
  </div>
{/if}
