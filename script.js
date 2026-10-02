/* ==========================================================================
   PABLO BARBER — script principal (vanilla JS, aucune dépendance)
   ========================================================================== */
(() => {
  'use strict';

  /* ======================================================================
     CONFIGURATION — à personnaliser
     ====================================================================== */
  const CONFIG = {
    calendlyUrl: 'https://calendly.com/pablocornierlecan/coupe',
    calendlyParams: 'hide_gdpr_banner=1&locale=fr',
    instagramUrl: 'https://www.instagram.com/pablo.barb3r/',
    imagesDir: 'images',
    photoExt: 'jpg',          // extension des photos : 1.jpg, 2.jpg…
    videoFile: 'reel.mp4',    // nom de la vidéo dans chaque dossier
    posterFile: 'poster.jpg', // image affichée avant lecture (si poster: true)
  };

  // Libellés des filtres (l'ordre ici = l'ordre des boutons)
  const CATEGORIES = {
    fade: 'Fade',
    taper: 'Taper',
    barbe: 'Barbe',
    classique: 'Classique',
  };

  /* Vitrine : une ligne = une coupe.
     - folder   : sous-dossier de images/ contenant 1.jpg … N.jpg (+ reel.mp4)
     - category : une clé de CATEGORIES, ou un tableau de clés
     - photos   : nombre de photos
     - video    : true si images/<folder>/reel.mp4 existe
     - poster   : (facultatif) true si images/<folder>/poster.jpg existe
     - alts     : (facultatif) textes alternatifs personnalisés, un par photo */
  const CUTS = [
    {
      title: 'Taper', category: 'taper', folder: 'taper', photos: 2, video: false,
      alts: [
        "Taper avec frange texturée, vue de profil : transition nette autour de l'oreille",
        'Taper vue de dos : dégradé progressif sur la nuque, dessus texturé',
      ],
    },
  ];

  /* ====================================================================== */

  window.PB_READY = true;

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const scrollBehavior = () => (reducedMotion.matches ? 'auto' : 'smooth');
  const hasIO = 'IntersectionObserver' in window;
  const escapeHTML = (str) => String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  /* ---------- Placeholders si un média est absent ---------- */
  function makePlaceholder(label, dark = false) {
    const ph = document.createElement('div');
    ph.className = dark ? 'ph ph--dark' : 'ph';
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', label);
    ph.innerHTML = `<i class="fa-solid fa-scissors" aria-hidden="true"></i><span aria-hidden="true">${escapeHTML(label)}</span>`;
    return ph;
  }

  function guardImage(img) {
    const swap = () => img.replaceWith(makePlaceholder('Photo à venir'));
    if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) swap();
    else img.addEventListener('error', swap, { once: true });
  }
  $$('img[data-fallback]').forEach(guardImage);

  /* ---------- Blocage du scroll de l'arrière-plan ---------- */
  let lockCount = 0;
  function lockScroll() {
    if (lockCount++ > 0) return;
    const root = document.documentElement;
    root.style.setProperty('--scrollbar', `${window.innerWidth - root.clientWidth}px`);
    root.classList.add('is-locked');
  }
  function unlockScroll() {
    if (lockCount === 0 || --lockCount > 0) return;
    document.documentElement.classList.remove('is-locked');
  }

  /* ======================================================================
     DIALOGUES (modale Calendly + lightbox) : focus, Échap, inert, scroll
     ====================================================================== */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), iframe, video[controls], [tabindex]:not([tabindex="-1"])';
  const dialogStack = [];

  function createDialog(root, { onOpen, onClose, onKey } = {}) {
    const panel = $('[role="dialog"]', root);
    let lastFocus = null;
    let hideTimer = null;
    let inerted = [];

    const api = {
      panel,
      onKey,
      isOpen: false,
      open(trigger) {
        if (api.isOpen) return;
        api.isOpen = true;
        lastFocus = trigger || document.activeElement;
        clearTimeout(hideTimer);
        root.hidden = false;
        void root.offsetWidth; // force le reflow pour déclencher la transition
        root.classList.add('is-open');

        inerted = [...document.body.children].filter(
          (el) => el !== root && !el.inert && el.tagName !== 'SCRIPT'
        );
        inerted.forEach((el) => { el.inert = true; });

        lockScroll();
        dialogStack.push(api);
        document.body.classList.add('has-dialog');
        if (onOpen) onOpen();
        panel.focus({ preventScroll: true });
      },
      close() {
        if (!api.isOpen) return;
        api.isOpen = false;
        root.classList.remove('is-open');
        inerted.forEach((el) => { el.inert = false; });
        inerted = [];
        unlockScroll();
        dialogStack.splice(dialogStack.indexOf(api), 1);
        if (!dialogStack.length) document.body.classList.remove('has-dialog');
        if (onClose) onClose();
        hideTimer = setTimeout(() => { root.hidden = true; }, reducedMotion.matches ? 0 : 280);
        if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
      },
    };

    root.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) api.close();
    });
    return api;
  }

  function trapFocus(container, e) {
    const items = $$(FOCUSABLE, container).filter((el) => el.getClientRects().length);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !container.contains(active) || active === container)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !container.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener('keydown', (e) => {
    const top = dialogStack[dialogStack.length - 1];
    if (!top) return;
    if (e.key === 'Escape') { e.preventDefault(); top.close(); }
    else if (e.key === 'Tab') trapFocus(top.panel, e);
    else if (top.onKey) top.onKey(e);
  });

  /* ======================================================================
     THÈME CLAIR / SOMBRE (le thème initial est posé par le script du <head>)
     ====================================================================== */
  const root = document.documentElement;
  const themeToggle = $('.theme-toggle');
  const themeMeta = $('meta[name="theme-color"]');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => (root.dataset.theme === 'dark' ? 'dark' : 'light');

  function applyTheme(theme, save) {
    root.dataset.theme = theme;
    if (themeMeta) themeMeta.content = theme === 'dark' ? '#040e2d' : '#ffffff';
    themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Activer le mode clair' : 'Activer le mode sombre');
    if (save) { try { localStorage.setItem('pb-theme', theme); } catch (e) { /* stockage indisponible */ } }
  }

  applyTheme(currentTheme(), false);
  themeToggle.addEventListener('click', () => applyTheme(currentTheme() === 'dark' ? 'light' : 'dark', true));
  systemDark.addEventListener('change', (e) => {
    let saved = null;
    try { saved = localStorage.getItem('pb-theme'); } catch (err) { /* ignoré */ }
    if (!saved) applyTheme(e.matches ? 'dark' : 'light', false); // on ne suit le système que si aucun choix n'a été fait
  });

  /* ======================================================================
     NAVIGATION : burger, état « scrolled », lien actif
     ====================================================================== */
  const navbar = $('#navbar');
  const burger = $('.burger');
  const nav = $('#nav-menu');
  const desktopNav = window.matchMedia('(min-width: 900px)');

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    nav.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
  }
  const menuIsOpen = () => burger.getAttribute('aria-expanded') === 'true';

  burger.addEventListener('click', () => setMenu(!menuIsOpen()));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuIsOpen()) { setMenu(false); burger.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (menuIsOpen() && !navbar.contains(e.target)) setMenu(false);
  });
  desktopNav.addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      navbar.classList.toggle('is-scrolled', window.scrollY > 8);
      scrollTicking = false;
    });
  }, { passive: true });

  if (hasIO) {
    const links = $$('.nav__link');
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => {
          if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('main section[id]').forEach((s) => spy.observe(s));
  }

  /* ======================================================================
     RÉSERVATION CALENDLY (script chargé à la première ouverture)
     ====================================================================== */
  const bookingModal = $('#booking-modal');
  const bookingWidget = $('#booking-widget');
  const bookingLoader = $('#booking-loader');
  const calendlyConfigured = !/VOTRE-LIEN/.test(CONFIG.calendlyUrl);
  const calendlyUrl = `${CONFIG.calendlyUrl}${CONFIG.calendlyUrl.includes('?') ? '&' : '?'}${CONFIG.calendlyParams}`;
  let calendlyScript = null;
  let widgetMounted = false;

  function loadCalendly() {
    if (window.Calendly) return Promise.resolve();
    if (!calendlyScript) {
      calendlyScript = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://assets.calendly.com/assets/external/widget.js';
        s.async = true;
        s.onload = resolve;
        s.onerror = () => { calendlyScript = null; s.remove(); reject(new Error('Calendly')); };
        document.head.appendChild(s);
      });
    }
    return calendlyScript;
  }

  function showBookingError(message) {
    bookingLoader.hidden = true;
    const link = calendlyConfigured
      ? `<a class="btn btn--accent" href="${escapeHTML(calendlyUrl)}" target="_blank" rel="noopener">Ouvrir l'agenda</a>`
      : `<a class="btn btn--accent" href="${CONFIG.instagramUrl}" target="_blank" rel="noopener">Écrire sur Instagram</a>`;
    bookingWidget.innerHTML = `<div class="booking-error"><i class="fa-solid fa-calendar-xmark" aria-hidden="true"></i><p>${message}</p>${link}</div>`;
  }

  async function mountBooking() {
    if (widgetMounted) return;
    if (!calendlyConfigured) {
      showBookingError("La réservation en ligne n'est pas disponible pour l'instant. Écris-moi en message privé sur Instagram.");
      return;
    }
    bookingLoader.hidden = false;
    try {
      await loadCalendly();
      bookingWidget.innerHTML = '';
      window.Calendly.initInlineWidget({ url: calendlyUrl, parentElement: bookingWidget });
      widgetMounted = true;
      const iframe = $('iframe', bookingWidget);
      if (iframe) {
        iframe.title = 'Agenda de réservation Pabl’OBarber';
        iframe.addEventListener('load', () => { bookingLoader.hidden = true; }, { once: true });
      }
    } catch {
      showBookingError("Impossible de charger l'agenda. Vérifie ta connexion ou ouvre-le dans un nouvel onglet.");
    }
  }

  window.addEventListener('message', (e) => {
    if (e.origin === 'https://calendly.com' && typeof e.data?.event === 'string' && e.data.event.startsWith('calendly.')) {
      bookingLoader.hidden = true;
    }
  });

  const booking = createDialog(bookingModal, { onOpen: mountBooking });

  $$('.js-book').forEach((btn) => {
    if (calendlyConfigured) btn.href = calendlyUrl; // permet aussi « ouvrir dans un nouvel onglet »
    btn.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      setMenu(false);
      booking.open(btn);
    });
  });

  /* ======================================================================
     VITRINE : construction depuis CUTS, filtres, carrousels, vidéos
     ====================================================================== */
  const cutsRoot = $('#cuts');
  const filtersRoot = $('#filters');
  const galleryStatus = $('#gallery-status');
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const catsOf = (cut) => (Array.isArray(cut.category) ? cut.category : [cut.category]);

  // Liste des médias d'une coupe (vidéo en premier) — partagée avec la lightbox
  function mediaOf(cut) {
    const base = `${CONFIG.imagesDir}/${cut.folder}`;
    const items = [];
    if (cut.video) {
      items.push({
        type: 'video',
        src: `${base}/${CONFIG.videoFile}`,
        poster: cut.poster ? `${base}/${CONFIG.posterFile}` : '',
        alt: `${cut.title} — vidéo`,
      });
    }
    for (let i = 1; i <= cut.photos; i++) {
      items.push({
        type: 'image',
        src: `${base}/${i}.${CONFIG.photoExt}`,
        alt: (cut.alts && cut.alts[i - 1]) || `Coupe ${cut.title} — photo ${i} sur ${cut.photos}`,
      });
    }
    return items;
  }

  function renderCut(cut, index) {
    const id = slug(cut.title) || `coupe-${index}`;
    const media = mediaOf(cut);
    const cats = catsOf(cut);
    const offset = cut.video ? 1 : 0;
    const titleEsc = escapeHTML(cut.title);

    const video = cut.video ? `
      <button class="cut__video" type="button" data-index="0" aria-label="Voir le reel ${titleEsc} en plein écran">
        <video muted loop playsinline preload="metadata" aria-hidden="true" data-src="${escapeHTML(media[0].src)}"${media[0].poster ? ` poster="${escapeHTML(media[0].poster)}"` : ''}></video>
        <span class="cut__badge"><i class="fa-solid fa-play" aria-hidden="true"></i> Reel</span>
      </button>` : '';

    const slides = media.slice(offset).map((m, i) => `
      <li class="carousel__slide">
        <button class="carousel__open" type="button" data-index="${i + offset}" aria-label="Agrandir la photo ${i + 1} sur ${cut.photos} : ${titleEsc}">
          <img src="${escapeHTML(m.src)}" alt="${escapeHTML(m.alt)}" width="600" height="800" loading="lazy" decoding="async">
        </button>
      </li>`).join('');

    const article = document.createElement('article');
    article.className = `cut reveal${cut.video ? '' : ' cut--no-video'}`;
    article.id = `coupe-${id}`;
    article.dataset.category = cats.join(' ');
    article.setAttribute('aria-labelledby', `cut-${id}-title`);
    article.innerHTML = `
      <header class="cut__head">
        <div>
          <h3 class="cut__title" id="cut-${id}-title">${titleEsc}</h3>
          <p class="cut__tags">${cats.map((c) => `<span class="cut__tag">${escapeHTML(CATEGORIES[c] || c)}</span>`).join('')}</p>
        </div>
        <div class="cut__controls">
          <button class="icon-btn" type="button" data-dir="-1" aria-controls="track-${id}" aria-label="Photos précédentes : ${titleEsc}">
            <i class="fa-solid fa-arrow-left" aria-hidden="true"></i>
          </button>
          <button class="icon-btn" type="button" data-dir="1" aria-controls="track-${id}" aria-label="Photos suivantes : ${titleEsc}">
            <i class="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
      </header>
      <div class="cut__body">
        ${video}
        <div class="carousel">
          <ul class="carousel__track" id="track-${id}" aria-label="Photos : ${titleEsc}">${slides}</ul>
        </div>
      </div>`;

    $$('img', article).forEach(guardImage);
    article._pb = { cut, media };
    return article;
  }

  /* ----- Carrousels ----- */
  function updateCarousel(article) {
    const track = $('.carousel__track', article);
    const [prev, next] = $$('.cut__controls .icon-btn', article);
    const max = track.scrollWidth - track.clientWidth;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max - 2;
    prev.parentElement.style.visibility = max > 2 ? '' : 'hidden'; // tout tient à l'écran : flèches inutiles
  }

  function initCarousel(article) {
    const track = $('.carousel__track', article);
    let ticking = false;
    track.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { updateCarousel(article); ticking = false; });
    }, { passive: true });
    track.addEventListener('scrollend', () => updateCarousel(article)); // état final garanti après le snap

    $$('.cut__controls .icon-btn', article).forEach((btn) => {
      btn.addEventListener('click', () => {
        const slide = $('.carousel__slide', track);
        if (!slide) return;
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        track.scrollBy({ left: Number(btn.dataset.dir) * (slide.offsetWidth + gap), behavior: scrollBehavior() });
      });
    });
    updateCarousel(article);
  }

  /* ----- Vidéos : src ajoutée à l'approche, lecture au survol (desktop) ou dans le viewport (mobile) ----- */
  function attachVideoSrc(video) {
    if (!video.dataset.src) return;
    video.src = video.dataset.src;
    delete video.dataset.src;
  }
  const playVideo = (video) => {
    attachVideoSrc(video);
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };

  function initVideo(article, observers) {
    const btn = $('.cut__video', article);
    if (!btn) return;
    const video = $('video', btn);

    video.addEventListener('error', () => {
      video.replaceWith(makePlaceholder('Reel à venir', true));
    }, { once: true });

    if (observers.load) observers.load.observe(video);
    else attachVideoSrc(video);

    if (finePointer.matches) {
      btn.addEventListener('mouseenter', () => playVideo(video));
      btn.addEventListener('mouseleave', () => video.pause());
    } else if (observers.play && !reducedMotion.matches) {
      observers.play.observe(video);
    }
  }

  function buildGallery() {
    if (!cutsRoot) return;

    const observers = {};
    if (hasIO) {
      observers.load = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { attachVideoSrc(entry.target); obs.unobserve(entry.target); }
        });
      }, { rootMargin: '300px 0px' });

      observers.play = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !document.body.classList.contains('has-dialog')) playVideo(entry.target);
          else entry.target.pause();
        });
      }, { threshold: 0.6 });
    }

    const fragment = document.createDocumentFragment();
    const articles = CUTS.map((cut, i) => {
      const article = renderCut(cut, i);
      fragment.appendChild(article);
      return article;
    });
    cutsRoot.appendChild(fragment);

    articles.forEach((article) => {
      initCarousel(article);
      initVideo(article, observers);
    });

    cutsRoot.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-index]');
      if (!trigger) return;
      const article = trigger.closest('.cut');
      lightbox.show(article._pb, Number(trigger.dataset.index), trigger);
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => articles.forEach(updateCarousel), 150);
    });

    buildFilters(articles);
  }

  /* ----- Filtres ----- */
  function buildFilters(articles) {
    if (!filtersRoot) return;
    const present = Object.keys(CATEGORIES).filter((key) => CUTS.some((c) => catsOf(c).includes(key)));
    if (present.length < 2) { filtersRoot.hidden = true; return; } // un seul type de coupe : filtres inutiles
    const count = (key) => (key === 'all' ? CUTS.length : CUTS.filter((c) => catsOf(c).includes(key)).length);
    const options = [['all', 'Tous'], ...present.map((k) => [k, CATEGORIES[k]])];

    filtersRoot.innerHTML = options.map(([key, label]) => `
      <button class="filter" type="button" data-filter="${key}" aria-pressed="${key === 'all'}">
        ${escapeHTML(label)}<span class="filter__count" aria-hidden="true">${count(key)}</span>
      </button>`).join('');

    filtersRoot.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter');
      if (!btn) return;
      const key = btn.dataset.filter;
      $$('.filter', filtersRoot).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));

      let visible = 0;
      articles.forEach((article) => {
        const show = key === 'all' || article.dataset.category.split(' ').includes(key);
        article.hidden = !show;
        if (show) {
          visible++;
          article.classList.add('is-visible');
          updateCarousel(article);
        } else {
          const v = $('video', article);
          if (v) v.pause();
        }
      });
      galleryStatus.textContent = `${visible} coupe${visible > 1 ? 's' : ''} affichée${visible > 1 ? 's' : ''}`;
    });
  }

  /* ======================================================================
     LIGHTBOX : photos + vidéos, clavier (← → Échap), swipe
     ====================================================================== */
  const lightbox = (() => {
    const root = $('#lightbox');
    const stage = $('#lightbox-stage');
    const caption = $('#lightbox-caption');
    const navBtns = $$('.lightbox__nav', root);
    let state = { cut: null, media: [], index: 0 };

    function render() {
      const item = state.media[state.index];
      stage.innerHTML = '';
      let el;
      if (item.type === 'video') {
        el = document.createElement('video');
        Object.assign(el, { src: item.src, controls: true, autoplay: true, muted: true, loop: true, playsInline: true });
        if (item.poster) el.poster = item.poster;
        el.setAttribute('aria-label', item.alt);
        el.addEventListener('error', () => el.replaceWith(makePlaceholder('Reel à venir', true)), { once: true });
      } else {
        el = document.createElement('img');
        el.src = item.src;
        el.alt = item.alt;
        el.decoding = 'async';
        el.addEventListener('error', () => el.replaceWith(makePlaceholder('Photo à venir', true)), { once: true });
      }
      stage.appendChild(el);
      caption.innerHTML = `<strong>${escapeHTML(state.cut.title)}</strong> ${state.index + 1} / ${state.media.length}`;
      navBtns.forEach((b) => { b.hidden = state.media.length < 2; });

      // Précharge la photo suivante
      const next = state.media[(state.index + 1) % state.media.length];
      if (next && next.type === 'image') { const pre = new Image(); pre.src = next.src; }
    }

    function step(dir) {
      if (state.media.length < 2) return;
      state.index = (state.index + dir + state.media.length) % state.media.length;
      render();
    }

    const dialog = createDialog(root, {
      onOpen: () => $$('.cut video').forEach((v) => v.pause()),
      onClose: () => { stage.innerHTML = ''; },
      onKey: (e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      },
    });

    navBtns.forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.step))));

    // Clic à côté du média = fermeture
    stage.addEventListener('click', (e) => { if (e.target === stage) dialog.close(); });

    // Swipe horizontal
    let startX = 0;
    let startY = 0;
    stage.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    return {
      show({ cut, media }, index, trigger) {
        state = { cut, media, index };
        render();
        dialog.open(trigger);
      },
    };
  })();

  buildGallery();

  /* ======================================================================
     BOUTON FLOTTANT : masqué tant que le hero (et son bouton) est visible
     ====================================================================== */
  const fab = $('.fab');
  const hero = $('#accueil');
  if (fab && hero && hasIO) {
    new IntersectionObserver(([entry]) => {
      fab.classList.toggle('is-hidden', entry.isIntersecting);
    }, { threshold: 0.35 }).observe(hero);
  }

  /* ======================================================================
     ANIMATIONS D'APPARITION
     ====================================================================== */
  const reveals = $$('.reveal');
  if (!hasIO || reducedMotion.matches) {
    reveals.forEach((el) => el.classList.add('is-visible'));
  } else {
    // Léger décalage pour les éléments frères qui apparaissent ensemble
    $$('.features, .hero__inner').forEach((group) => {
      $$(':scope > .reveal', group).forEach((el, i) => el.style.setProperty('--reveal-delay', `${i * 80}ms`));
    });
    const revealer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    reveals.forEach((el) => revealer.observe(el));
  }

  /* ======================================================================
     CURSEUR PERSONNALISÉ (desktop uniquement)
     ====================================================================== */
  if (finePointer.matches && !reducedMotion.matches) {
    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cursor);

    let x = -100, y = -100, cx = -100, cy = -100, running = false;
    const loop = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      if (Math.abs(x - cx) > 0.1 || Math.abs(y - cy) > 0.1) requestAnimationFrame(loop);
      else running = false;
    };

    document.addEventListener('mousemove', (e) => {
      x = e.clientX;
      y = e.clientY;
      cursor.classList.add('is-active');
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('mouseover', (e) => {
      cursor.classList.toggle('is-hover', !!e.target.closest('a, button, label, input, select, textarea'));
    });
    document.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget) cursor.classList.remove('is-active');
    });
  }

  /* ---------- Année du footer ---------- */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
