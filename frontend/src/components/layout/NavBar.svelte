<script>
  // En-tête du site : barre transparente au-dessus des photos, nuit une fois la page défilée.
  // Sur téléphone : logo + menu en haut, barre d'onglets fixe en bas.
  import { page } from "$app/stores";
  import { fly, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { tick } from "svelte";
  import get from "lodash.get";
  import config from "../../stores/config";
  import { setToken } from "../../utils/api";

  // Pages qui commencent par une grande photo sombre : la barre peut y être transparente.
  const DARK_TOP = ["/", "/maison", "/ministeres", "/extensions", "/mediatheque", "/live", "/donate"];

  let scrollY = 0;
  let menuOpen = false;
  let menuBtn;
  let sheet;
  let isMobile = false;

  $: path = $page.url.pathname.replace(/\/$/, "") || "/";
  $: hash = $page.url.hash;
  $: solid = scrollY > 40 || !DARK_TOP.includes(path);
  $: user = get($config, "currentUser");
  $: isStaff = ["media", "admin", "super-admin"].includes(get($config, "currentUser.role"));

  // Ordre conventionnel : accueil, présentation, activités, contenus, contact.
  const LINKS = [
    { href: "/", label: "Accueil" },
    { href: "/maison", label: "À propos" },
    { href: "/#programme", label: "Programme" },
    { href: "/ministeres", label: "Ministères" },
    { href: "/extensions", label: "Extensions" },
    { href: "/mediatheque", label: "Médiathèque" },
    { href: "/live", label: "Direct" },
    { href: "#contact", label: "Contact" },
  ];

  const TABS = [
    { key: "home", href: "/", label: "Accueil", icon: "M4 11l8-7 8 7v9h-5v-6H9v6H4z" },
    { key: "prog", href: "/#programme", label: "Programme", icon: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4" },
    { key: "media", href: "/mediatheque", label: "Messages", icon: "M4 6h16v12H4zM10 9.5v5l4.5-2.5z" },
    { key: "live", href: "/live", label: "Direct", icon: "M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4" },
    { key: "give", href: "/#don", label: "Donner", icon: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" },
  ];
  $: activeTab =
    path === "/mediatheque" ? "media" : path === "/live" ? "live" : path === "/donate" ? "give"
    : path === "/" ? (hash === "#programme" ? "prog" : hash === "#don" ? "give" : "home") : null;
  $: tabIndex = TABS.findIndex((t) => t.key === activeTab);
  $: current = (href) => (href === path ? "page" : undefined);

  async function openMenu() {
    isMobile = window.matchMedia("(max-width: 767px)").matches;
    menuOpen = true;
    await tick();
    const first = sheet && sheet.querySelector("a, button");
    if (first) first.focus();
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    if (menuBtn) menuBtn.focus();
  }
  function onKey(e) {
    if (!menuOpen) return;
    if (e.key === "Escape") closeMenu();
    if (e.key === "Tab" && sheet) {
      // le focus reste dans le menu tant qu'il est ouvert
      const items = [...sheet.querySelectorAll("a, button")];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  const handleLogout = () => {
    setToken(null);
    config.update((prev) => ({ ...prev, currentUser: null }));
    window.location = "/login";
  };
</script>

<svelte:window bind:scrollY on:keydown={onKey} />

<a href="#contenu" class="skip-link">Aller au contenu</a>

<header
  class="fixed top-0 inset-x-0 z-50 text-white transition-colors duration-300"
  class:bg-man-nuit={solid}
  class:shadow-header={solid}
>
  <div class="max-w-[1320px] mx-auto h-16 md:h-[76px] px-5 md:px-10 flex items-center justify-between gap-6">
    <a href="/" class="flex items-center gap-3 min-h-[44px]" aria-label="Maison d'Adoration pour les Nations, accueil">
      <img src="/images/man-gold.png" alt="" class="w-10 md:w-11" width="44" height="44" />
      <span class="font-slab font-bold text-[22px] tracking-[.03em]">M.A.N</span>
    </a>

    <nav aria-label="Navigation principale" class="hidden lg:flex items-center gap-4 xl:gap-6 text-[14px] xl:text-[15px] font-semibold whitespace-nowrap">
      {#each LINKS as l}
        <a href={l.href} class="nav-u text-man-texte hover:text-white" aria-current={current(l.href)}>{l.label}</a>
      {/each}
    </nav>

    <div class="flex items-center gap-2">
      {#if user}
        <a href="/mes-contenus" class="hidden md:inline-flex lg:hidden xl:inline-flex items-center min-h-[44px] px-3 text-sm font-bold text-man-texte hover:text-white">Mon espace</a>
      {:else}
        <a href="/login" class="hidden md:inline-flex lg:hidden xl:inline-flex items-center min-h-[44px] px-3 text-sm font-bold text-man-texte hover:text-white">Connexion</a>
      {/if}
      <a href="/#don" class="hidden md:inline-flex btn-ghost !min-h-[44px] !px-5 text-sm">Donner</a>
      <button
        bind:this={menuBtn}
        type="button"
        class="press w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10"
        aria-label="Menu"
        aria-expanded={menuOpen}
        aria-controls="menu-site"
        on:click={openMenu}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 8h16M4 16h10" /></svg>
      </button>
    </div>
  </div>
</header>

<!-- Barre d'onglets (téléphone) -->
<nav
  aria-label="Navigation rapide"
  class="md:hidden fixed bottom-0 inset-x-0 z-50 h-[74px] pb-[env(safe-area-inset-bottom)] bg-man-nuit/95 backdrop-blur-md border-t border-man-trait grid grid-cols-5 px-1.5"
>
  {#if tabIndex >= 0}
    <span aria-hidden="true" class="man-ind absolute top-0 left-1.5 h-[3px] flex justify-center" style="width: calc((100% - 12px) / 5); transform: translateX({tabIndex * 100}%)">
      <span class="w-7 h-[3px] rounded-b bg-man-or"></span>
    </span>
  {/if}
  {#each TABS as t}
    <a
      href={t.href}
      class="flex flex-col items-center justify-center gap-1 text-[11.5px] font-extrabold transition-colors"
      style="color: {activeTab === t.key ? '#E4BE05' : '#B9C9DD'}"
      aria-current={activeTab === t.key ? "page" : undefined}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
      {t.label}
    </a>
  {/each}
</nav>

{#if menuOpen}
  <div class="fixed inset-0 z-[60] bg-[#050d1a]/60" transition:fade={{ duration: 220 }} on:click={closeMenu} role="presentation"></div>
  <div
    bind:this={sheet}
    id="menu-site"
    role="dialog"
    aria-modal="true"
    aria-label="Menu du site"
    class="fixed z-[61] bg-man-nuit2 text-white overflow-y-auto inset-x-0 bottom-0 max-h-[88vh] rounded-t-[28px] md:inset-y-0 md:left-auto md:right-0 md:w-[26rem] md:max-h-none md:rounded-none md:rounded-l-[28px]"
    transition:fly={isMobile ? { y: 500, duration: 380, easing: cubicOut, opacity: 1 } : { x: 420, duration: 340, easing: cubicOut, opacity: 1 }}
  >
    <div class="flex items-center justify-between px-6 pt-4 pb-2">
      <img src="/images/man-gold.png" alt="" class="w-10" width="40" height="40" />
      <button type="button" class="press w-11 h-11 rounded-full flex items-center justify-center hover:bg-white/10" aria-label="Fermer le menu" on:click={closeMenu}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
    <nav aria-label="Toutes les pages" class="px-6">
      {#each [...LINKS, { href: "/#visite", label: "Planifier ma visite" }, { href: "/#don", label: "Donner" }] as l}
        <a href={l.href} on:click={closeMenu} class="flex items-center justify-between min-h-[56px] border-b border-man-trait font-slab font-bold text-[21px]">
          {l.label}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4AB0EB" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </a>
      {/each}
    </nav>
    <div class="px-6 pt-6 pb-4 grid grid-cols-2 gap-2 text-[15px] font-bold">
      {#if user}
        <a href="/mes-contenus" on:click={closeMenu} class="rounded-2xl bg-man-nuit3 px-4 min-h-[52px] flex items-center">Mes contenus</a>
        <a href="/profile" on:click={closeMenu} class="rounded-2xl bg-man-nuit3 px-4 min-h-[52px] flex items-center">Mon profil</a>
        {#if isStaff}
          <a href="/adm" on:click={closeMenu} class="rounded-2xl bg-man-nuit3 px-4 min-h-[52px] flex items-center">Administration</a>
        {/if}
        <button type="button" on:click={handleLogout} class="rounded-2xl bg-man-nuit3 px-4 min-h-[52px] flex items-center text-left">Se déconnecter</button>
      {:else}
        <a href="/login" on:click={closeMenu} class="btn-or">Connexion</a>
        <a href="/register" on:click={closeMenu} class="btn-ghost">Inscription</a>
      {/if}
    </div>
    <div class="px-6 pb-8 pt-2 flex items-center gap-1 text-man-doux">
      <a class="w-11 h-11 flex items-center justify-center hover:text-white" target="_blank" rel="noopener" href="https://www.youtube.com/@mantv6688" aria-label="Chaîne YouTube MAN TV"><ion-icon name="logo-youtube" class="text-xl"></ion-icon></a>
      <a class="w-11 h-11 flex items-center justify-center hover:text-white" target="_blank" rel="noopener" href="https://www.instagram.com/maisondadoration_man" aria-label="Instagram"><ion-icon name="logo-instagram" class="text-xl"></ion-icon></a>
      <a class="w-11 h-11 flex items-center justify-center hover:text-white" target="_blank" rel="noopener" href="https://web.facebook.com/Maisondadorationpourlesnations" aria-label="Facebook"><ion-icon name="logo-facebook" class="text-xl"></ion-icon></a>
      <a class="w-11 h-11 flex items-center justify-center hover:text-white" target="_blank" rel="noopener" href="https://coachisraelkayembe.com" aria-label="Site du Prophète Israël Kayembe"><ion-icon name="globe-outline" class="text-xl"></ion-icon></a>
    </div>
  </div>
{/if}

<style>
  .nav-u { position: relative; transition: color 160ms ease; }
  .nav-u::after { content: ""; position: absolute; left: 0; right: 0; bottom: -6px; height: 2px; background: #E4BE05; transform: scaleX(0); transform-origin: left; transition: transform 240ms cubic-bezier(.23,1,.32,1); }
  .nav-u[aria-current="page"]::after { transform: scaleX(1); }
  @media (hover: hover) and (pointer: fine) { .nav-u:hover::after { transform: scaleX(1); } }
  .shadow-header { box-shadow: 0 1px 0 #1E3A63; }
  @media (prefers-reduced-motion: reduce) { .nav-u::after { transition: none; } }
</style>
