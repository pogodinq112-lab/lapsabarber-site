/* LapsaBarber — dati, čeks, galerija, animācijas.
   Saturs (cenas, pakalpojumi, foto) nāk no /content.json. */
(function () {
  "use strict";

  var root = document.documentElement;
  var MOTION = root.classList.contains("motion");
  var FINE = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) gsap.registerPlugin(ScrollTrigger);
  if (!hasGSAP) { root.classList.remove("motion"); MOTION = false; }

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  $("#year").textContent = new Date().getFullYear();
  if (MOTION) initIntro();

  /* =========================================================
     1. Saturs
     ========================================================= */
  fetch("content.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { build(data); afterBuild(data); })
    .catch(function () {
      $$("[data-list]").forEach(function (el) {
        el.innerHTML = '<p style="padding:12px 0">Cenas neielādējās. Zvani <a href="tel:+37127885889">+371 27885889</a> vai skaties <a href="https://www.instagram.com/lapsa_barber/">Instagram</a>.</p>';
      });
      afterBuild(null);
    });

  function build(d) {
    // saites no satura faila
    $$("[data-book]").forEach(function (a) { a.href = d.booking; });
    $$("[data-phone]").forEach(function (a) { a.href = "tel:" + d.phone; });
    $$("[data-map]").forEach(function (a) { a.href = d.map; });
    $$("[data-ig]").forEach(function (a) { a.href = d.instagram; });

    var row = function (item, type, name) {
      return '<label class="r-row" data-type="' + type + '" data-id="' + esc(item.id) + '">' +
        '<input type="' + type + '" name="' + name + '" value="' + esc(item.id) + '">' +
        '<span class="r-box" aria-hidden="true"></span>' +
        '<span class="r-name">' + esc(item.name) + (item.note ? "<small>" + esc(item.note) + "</small>" : "") + "</span>" +
        '<span class="r-dots" aria-hidden="true"></span>' +
        '<span class="r-price"><s class="r-was" aria-hidden="true"></s><span class="r-val">' + (item.from ? "no " : "") + item.price + "</span> €</span>" +
        "</label>";
    };
    $('[data-list="haircuts"]').innerHTML = d.haircuts.map(function (h) { return row(h, "radio", "griezums"); }).join("");
    $('[data-list="extras"]').innerHTML = d.extras.map(function (e) { return row(e, "checkbox", "klat"); }).join("");
    $('[data-list="included"]').innerHTML = d.included.map(function (i) {
      return '<li><span class="f-name">' + esc(i.name) + "<small>" + esc(i.note) + '</small></span><span class="r-dots" aria-hidden="true"></span><span class="f-price">0,00 €</span></li>';
    }).join("");
    $('[data-list="works"]').innerHTML = d.works.map(function (w, i) {
      // w/h nav obligāti: jauniem foto no admin paneļa pieņemam vertikālu 3:4
      return '<li class="work"><button type="button" data-i="' + i + '" aria-label="Atvērt foto: ' + esc(w.alt) + '">' +
        '<img src="' + esc(w.src) + '" width="' + (w.w || 900) + '" height="' + (w.h || 1200) + '" loading="lazy" alt="' + esc(w.alt) + '"></button>' +
        '<p class="work-cap"><b>' + esc(w.caption) + "</b></p></li>";
    }).join("");
    $('[data-list="team"]').innerHTML = d.team.map(function (t) {
      return "<li><b>" + esc(t.name) + "</b><span>" + esc(t.role) + "</span></li>";
    }).join("");
  }

  function afterBuild(d) {
    if (d) { initReceipt(d); initLightbox(d.works); }
    initDock();
    initHeader();
    if (MOTION) initMotion(); else revealAll();
    if (FINE && MOTION) { initCursor(); initMagnetic(); }
    root.classList.add("ready");
  }

  /* =========================================================
     2. Čeks: izvēle + summa
     ========================================================= */
  function initReceipt(d) {
    var form = $("#receipt");
    var numEl = $(".r-num", form), fromEl = $(".r-from", form);
    var dockNum = $(".dock-num"), dockFrom = $(".dock-from");
    var stamp = $(".r-stamp", form), hint = $("#hint");
    var all = d.haircuts.concat(d.extras);
    var byId = {}; all.forEach(function (x) { byId[x.id] = x; });
    var shown = 0, comboWas = false;
    var save = d.combo ? byId[d.combo.haircut].price + byId[d.combo.extra].price - d.combo.price : 0;
    $(".r-stamp b").textContent = "−" + save + " €";

    // sākumā: parastais griezums
    var first = $('input[value="' + d.haircuts[0].id + '"]', form);
    if (first) first.checked = true;

    function calc() {
      var sum = 0, from = false, picked = {};
      $$("input", form).forEach(function (inp) {
        var on = inp.checked;
        inp.closest(".r-row").classList.toggle("is-on", on);
        if (on) { picked[inp.value] = true; sum += byId[inp.value].price; if (byId[inp.value].from) from = true; }
      });
      var combo = d.combo && picked[d.combo.haircut] && picked[d.combo.extra];
      var extraRow = d.combo && $('.r-row[data-id="' + d.combo.extra + '"]', form);
      if (extraRow) {
        var ex = byId[d.combo.extra];
        $(".r-was", extraRow).textContent = combo ? ex.price : "";
        $(".r-val", extraRow).textContent = combo ? ex.price - save : ex.price;
        extraRow.classList.toggle("is-combo", !!combo);
      }
      if (combo) sum -= save;

      hint.textContent = combo ? d.combo.name + ": " + d.combo.price + " € kopā."
        : (d.combo ? d.combo.name + " kopā maksā " + d.combo.price + " €." : "");
      fromEl.hidden = !from; dockFrom.hidden = !from;
      countTo(sum);
      if (combo && !comboWas) stampIn(); else if (!combo && comboWas) stampOut();
      comboWas = !!combo;
    }

    function countTo(target) {
      if (!MOTION) { shown = target; numEl.textContent = dockNum.textContent = target; return; }
      var o = { v: shown };
      gsap.to(o, { v: target, duration: .6, ease: "power3.out", overwrite: true,
        onUpdate: function () { numEl.textContent = dockNum.textContent = Math.round(o.v); } });
      shown = target;
      gsap.fromTo(numEl.parentNode, { y: -6 }, { y: 0, duration: .45, ease: "back.out(3)" });
    }
    function stampIn() {
      stamp.classList.add("is-on");
      if (MOTION) gsap.fromTo(stamp, { scale: 2.2, rotate: -30, opacity: 0 }, { scale: 1, rotate: -14, opacity: .9, duration: .45, ease: "back.out(2.2)" });
    }
    function stampOut() {
      stamp.classList.remove("is-on");
      if (MOTION) gsap.fromTo(stamp, { opacity: .9 }, { opacity: 0, scale: .8, duration: .25 });
    }

    // radio var noņemt ar otru klikšķi (ja grib tikai bārdu vai manikīru)
    form.addEventListener("click", function (e) {
      var inp = e.target.closest("input[type=radio]");
      if (!inp) return;
      if (inp.dataset.was === "1") { inp.checked = false; inp.dataset.was = ""; calc(); }
      else { $$("input[type=radio]", form).forEach(function (r) { r.dataset.was = ""; }); inp.dataset.was = "1"; }
    });
    if (first) first.dataset.was = "1";
    form.addEventListener("change", calc);
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    calc();
  }

  /* =========================================================
     3. Mobilā josla + galvene
     ========================================================= */
  function initDock() {
    var dock = $("#dock"), hero = $(".hero"), foot = $(".foot");
    if (!("IntersectionObserver" in window)) { dock.classList.add("is-on"); return; }
    var heroOut = false, footIn = false;
    var set = function () { dock.classList.toggle("is-on", heroOut && !footIn); };
    new IntersectionObserver(function (en) { heroOut = !en[0].isIntersecting; set(); }, { threshold: .15 }).observe(hero);
    new IntersectionObserver(function (en) { footIn = en[0].isIntersecting; set(); }).observe(foot);
  }
  function initHeader() {
    var top = $("#top"), last = 0;
    window.addEventListener("scroll", function () {
      var y = window.scrollY;
      top.classList.toggle("is-solid", y > 40);
      top.classList.toggle("is-hidden", y > last && y > 400);
      last = y;
    }, { passive: true });
  }

  /* =========================================================
     4. Foto pilnekrānā
     ========================================================= */
  function initLightbox(works) {
    var dlg = $("#lightbox"), img = $(".lb-img", dlg), cap = $(".lb-cap", dlg), idx = 0, opener = null;
    if (!dlg.showModal) return;
    function show(i) {
      idx = (i + works.length) % works.length;
      img.src = works[idx].src; img.alt = works[idx].alt; cap.textContent = works[idx].caption;
      if (MOTION) gsap.fromTo(img, { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .45, ease: "power3.out" });
    }
    $(".works-track").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-i]"); if (!b) return;
      opener = b; show(+b.dataset.i); dlg.showModal();
      if (MOTION) gsap.fromTo(dlg, { opacity: 0 }, { opacity: 1, duration: .3 });
    });
    $(".lb-close", dlg).addEventListener("click", function () { dlg.close(); });
    $(".lb-prev", dlg).addEventListener("click", function () { show(idx - 1); });
    $(".lb-next", dlg).addEventListener("click", function () { show(idx + 1); });
    dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
    dlg.addEventListener("close", function () { if (opener) opener.focus(); });
    var sx = 0;
    dlg.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    dlg.addEventListener("touchend", function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1)); });
  }

  /* =========================================================
     5. Animācijas
     ========================================================= */
  function revealAll() { /* bez kustības viss jau redzams */ }

  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/);
    el.setAttribute("aria-label", el.textContent.trim());
    el.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true">' + esc(w) + "</span>"; }).join(" ");
    return $$(".w", el);
  }

  /* --- 5.1 Ievads: bārdas naža griezums ---
     Palaižas uzreiz, negaidot content.json, lai galvenais foto parādās ātri. */
  function initIntro() {
    var isWide = window.matchMedia("(min-width: 900px)").matches;
    var line = isWide ? ".cut-d" : ".cut-m";
    var openClip = isWide ? "polygon(22% 0, 100% 0, 100% 100%, 0 100%)" : "polygon(0 0, 100% 0, 100% 82%, 0 100%)";
    var midClip = isWide ? "polygon(22% 0, 30% 0, 8% 100%, 0 100%)" : "polygon(0 92%, 100% 74%, 100% 82%, 0 100%)";
    // CSS sāk ar translateY(105%); GSAP pārņem to pašu stāvokli caur yPercent
    gsap.set(".hero-title .line > span", { yPercent: 105, y: 0 });
    var intro = gsap.timeline({ defaults: { ease: "expo.out" }, delay: .05 });
    intro
      .fromTo(line, { strokeDashoffset: 3000 }, { strokeDashoffset: 0, duration: .6, ease: "expo.inOut" })
      .to(".hero-photo", { clipPath: midClip, duration: .25, ease: "power2.in" }, "-=.15")
      .addLabel("open")
      .to(".hero-photo", { clipPath: openClip, duration: 1.1 }, "open")
      .to(".hero-img", { scale: 1, duration: 1.8 }, "open")
      .to(".hero-title .line > span", { yPercent: 0, duration: 1.05, stagger: .09 }, "open+=.05")
      .to(".hero-wordmark", { opacity: 1, duration: .8 }, "open+=.25")
      .fromTo(".hero-sub", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .8 }, "open+=.5")
      .fromTo(".hero-cta", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .8 }, "open+=.6")
      .fromTo(".hero-facts", { opacity: 0 }, { opacity: 1, duration: 1 }, "open+=.75")
      // pēc ievada CSS atkal nosaka griezuma formu (mainot loga platumu, tā paliek pareiza)
      .add(function () { root.classList.add("intro-done"); gsap.set(".hero-photo, .hero-cut line", { clearProps: "clipPath,strokeDashoffset" }); });
    // drošības tīkls: ja animācija kaut kādu iemeslu dēļ apstājas, foto tik un tā parādās
    setTimeout(function () {
      if (root.classList.contains("intro-done")) return;
      intro.progress(1);
      root.classList.add("intro-done");
    }, 4000);
  }

  function initMotion() {
    var mm = gsap.matchMedia();

    // hero aiziet: foto lēnāk, teksts ātrāk
    gsap.to(".hero-img", { yPercent: 12, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero-copy", { yPercent: -18, opacity: .2, ease: "none", scrollTrigger: { trigger: ".hero", start: "40% top", end: "bottom top", scrub: true } });

    /* --- 5.2 Lente brauc līdzi ritināšanai --- */
    var track = $(".tape-track");
    var tapeTween = gsap.to(track, { xPercent: -50, ease: "none", duration: 26, repeat: -1 });
    // ritinot lente paātrinās un pagriežas ritināšanas virzienā, tad nomierinās
    ScrollTrigger.create({
      onUpdate: function (s) {
        var boost = 1 + Math.min(5, Math.abs(s.getVelocity()) / 300);
        gsap.timeline({ overwrite: true })
          .to(tapeTween, { timeScale: s.direction * boost, duration: .15, overwrite: true })
          .to(tapeTween, { timeScale: s.direction, duration: 1.1, ease: "power2.out" }, "+=.15");
      }
    });

    /* --- 5.3 Manifests: vārdi iedegas --- */
    var words = splitWords($("[data-words]"));
    // sākuma spilgtums .42: lielam tekstam kontrasts paliek ≥ 3:1
    gsap.fromTo(words, { opacity: .42 }, { opacity: 1, stagger: .1, ease: "none",
      scrollTrigger: { trigger: ".manifest-text", start: "top 80%", end: "bottom 55%", scrub: .6 } });
    gsap.fromTo(".manifest-photo img", { yPercent: -8, scale: 1.12 }, { yPercent: 8, scale: 1.12, ease: "none",
      scrollTrigger: { trigger: ".manifest", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from(".manifest-years", { x: -40, opacity: 0, duration: 1, ease: "expo.out",
      scrollTrigger: { trigger: ".manifest-years", start: "top 88%" } });

    /* --- 5.4 Čeks izdrukājas --- */
    gsap.from(".receipt", { yPercent: -100, duration: 1.6, ease: "power2.out",
      scrollTrigger: { trigger: ".printer", start: "top 75%" } });
    gsap.from(".prices-head .h2", { clipPath: "inset(0 100% 0 0)", duration: 1.1, ease: "expo.inOut",
      scrollTrigger: { trigger: ".prices-head", start: "top 80%" } });

    /* --- 5.5 Darbi: horizontāla lente (dators) / pavilkt ar pirkstu (telefons) --- */
    mm.add("(min-width: 1024px)", function () {
      var tr = $(".works-track");
      var dist = function () { return tr.scrollWidth - window.innerWidth; };
      gsap.to(tr, { x: function () { return -dist(); }, ease: "none",
        scrollTrigger: { trigger: ".works-pin", start: "top top", end: function () { return "+=" + dist(); },
          pin: true, scrub: .8, invalidateOnRefresh: true, anticipatePin: 1,
          onUpdate: function (s) { gsap.set(".works-bar span", { scaleX: s.progress }); } } });
    });
    mm.add("(max-width: 1023px)", function () {
      var vp = $(".works-viewport"), bar = $(".works-bar span");
      var onScroll = function () { var m = vp.scrollWidth - vp.clientWidth; bar.style.transform = "scaleX(" + (m > 0 ? vp.scrollLeft / m : 0) + ")"; };
      vp.addEventListener("scroll", onScroll, { passive: true }); onScroll();
      return function () { vp.removeEventListener("scroll", onScroll); };
    });
    gsap.from(".work", { y: 80, opacity: 0, stagger: .08, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: ".works", start: "top 70%" } });

    /* --- 5.6 Komanda: vārdi brauc pretī --- */
    gsap.fromTo(".tn-1", { xPercent: -12 }, { xPercent: 6, ease: "none", scrollTrigger: { trigger: ".team", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.fromTo(".tn-2", { xPercent: 10 }, { xPercent: -8, ease: "none", scrollTrigger: { trigger: ".team", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.fromTo(".team-photo", { clipPath: "inset(18% 8% 18% 8%)" }, { clipPath: "inset(0% 0% 0% 0%)", ease: "none",
      scrollTrigger: { trigger: ".team-photo", start: "top 90%", end: "top 30%", scrub: true } });
    gsap.fromTo(".team-photo img", { scale: 1.25 }, { scale: 1, ease: "none",
      scrollTrigger: { trigger: ".team-photo", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from(".team-quote", { y: 40, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: ".team-body", start: "top 85%" } });
    gsap.fromTo(".team-small img", { yPercent: 10, scale: 1.15 }, { yPercent: -6, scale: 1.15, ease: "none",
      scrollTrigger: { trigger: ".team-small", start: "top bottom", end: "bottom top", scrub: true } });

    /* --- 5.7 Mazie: foto atveras kā žalūzijas no apakšas --- */
    $$(".kp").forEach(function (kp, i) {
      gsap.fromTo(kp, { clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)", duration: 1.2, ease: "expo.inOut", delay: i * .12,
        scrollTrigger: { trigger: ".kids-photos", start: "top 80%" } });
      gsap.fromTo($("img", kp), { scale: 1.3 }, { scale: 1, duration: 1.6, ease: "expo.out", delay: i * .12 + .2,
        scrollTrigger: { trigger: ".kids-photos", start: "top 80%" } });
    });
    gsap.from(".kids-price strong", { textContent: 0, duration: 1.2, ease: "power2.out", snap: { textContent: 1 },
      scrollTrigger: { trigger: ".kids-price", start: "top 90%" } });

    /* --- 5.8 Kontakti: adrese izbīd no maskas --- */
    gsap.set(".contact-addr .line > span", { yPercent: 105 });
    gsap.to(".contact-addr .line > span", { yPercent: 0, stagger: .1, duration: 1.1, ease: "expo.out",
      scrollTrigger: { trigger: ".contact-addr", start: "top 85%" } });
    gsap.fromTo(".contact-photo img", { yPercent: -6, scale: 1.12 }, { yPercent: 6, scale: 1.12, ease: "none",
      scrollTrigger: { trigger: ".contact", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from(".cl", { x: -24, opacity: 0, stagger: .07, duration: .8, ease: "expo.out",
      scrollTrigger: { trigger: ".contact-links", start: "top 90%" } });

    // fonti var mainīt augstumus — pārrēķinām
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    window.addEventListener("load", function () { ScrollTrigger.refresh(); });
  }

  /* =========================================================
     6. Kursors + magnētiskās pogas (tikai pele)
     ========================================================= */
  function initCursor() {
    root.classList.add("has-cursor");
    var c = $(".cursor");
    var xTo = gsap.quickTo(c, "x", { duration: .35, ease: "power3" });
    var yTo = gsap.quickTo(c, "y", { duration: .35, ease: "power3" });
    window.addEventListener("pointermove", function (e) { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    document.addEventListener("pointerover", function (e) {
      var view = e.target.closest(".work button");
      var link = !view && e.target.closest("a, button, label.r-row");
      c.classList.toggle("is-view", !!view);
      c.classList.toggle("is-link", !!link);
    });
    document.addEventListener("pointerleave", function () { c.classList.add("is-hidden"); });
    document.addEventListener("pointerenter", function () { c.classList.remove("is-hidden"); });
  }
  function initMagnetic() {
    $$(".magnetic").forEach(function (b) {
      var xTo = gsap.quickTo(b, "x", { duration: .5, ease: "elastic.out(1, .4)" });
      var yTo = gsap.quickTo(b, "y", { duration: .5, ease: "elastic.out(1, .4)" });
      b.addEventListener("pointermove", function (e) {
        var r = b.getBoundingClientRect();
        xTo((e.clientX - r.left - r.width / 2) * .3);
        yTo((e.clientY - r.top - r.height / 2) * .4);
      });
      b.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
    });
  }
})();
