/* ==========================================================================
   PRINT STUDIO v2 — try any archive print on products, live in the browser
   Realism engine: silhouette zones + drape warp + multiply (fabric texture)
   + highlight sheen. Click a print → popup → product tabs + repeat scale.
   ========================================================================== */
(function () {
  "use strict";

  /*
    areas: print zones as [x%, y%, w%, h%] of the photo (one per garment panel;
           the pattern flows continuously across zones because every fill is
           anchored to the same canvas origin)
    base:  repeat width at 100% scale, as % of photo width
    drape: 0..1 — how much the pattern bends with the fabric folds
    sheen: 0..0.25 — strength of the highlight pass (fold lights on the print)
  */
  /* zones = polygons, points as [x%, y%, ...] of the photo — the print is
     clipped to the garment's real silhouette (bodice quads, triangle cups,
     flared skirt), and the pattern flows seamlessly across zones. */
  var PRODUCTS = [
    { id: "wallpaper", label: "Wallpaper", file: "mock-wallpaper.jpg",
      zones: [[3,3, 97,3, 97,89, 3,89]], base: 30, drape: 0, sheen: 0 },
    { id: "dress", label: "Dress", file: "mock-dress.jpg",
      zones: [[38,16, 64,16, 69,41, 32,41],      /* bodice */
              [32,41, 69,41, 79,89, 22,89]],     /* skirt  */
      base: 32, drape: 0.8, sheen: 0.15 },
    { id: "bikini", label: "Bikini", file: "mock-bikini.jpg",
      zones: [[39,28, 43,34, 43,52, 15,52, 17,46],  /* left cup  */
              [61,28, 57,34, 57,52, 85,52, 83,46],  /* right cup */
              [11,61, 86,61, 64,91, 36,91]],        /* brief     */
      base: 26, drape: 0.5, sheen: 0.18 },
    { id: "cushion", label: "Cushion 45\u00D745", file: "mock-cushion.jpg",
      zones: [[17,20, 67,20, 67,70, 17,70]], base: 46, drape: 0.35, sheen: 0.16 },
    { id: "tote", label: "Tote bag", file: "mock-tote.jpg",
      zones: [[31,52, 63,52, 63,82, 31,82]], base: 30, drape: 0.25, sheen: 0.10 },
    { id: "notebook", label: "Notebook A5", file: "mock-notebook.jpg",
      zones: [[25,14, 70,14, 70,84, 25,84]], base: 40, drape: 0, sheen: 0 },
    { id: "rug", label: "Rug", file: "mock-rug.jpg",
      zones: [[10,14, 86,14, 86,82, 10,82]], base: 38, drape: 0, sheen: 0.05 }
  ];
  var MOCK_DIR = "assets/img/mockups/";

  /* ---------- state ---------- */
  var prints = [], curPrint = 0, curProd = 0, scale = 100;
  var mockImgs = {}, open = false;

  /* ---------- build the popup once ---------- */
  var root = document.createElement("div");
  root.className = "pstudio";
  root.hidden = true;
  root.innerHTML =
    '<div class="ps-backdrop" data-ps-close></div>' +
    '<div class="ps-panel" role="dialog" aria-modal="true" aria-label="Print studio">' +
      '<button class="ps-close" data-ps-close aria-label="Close">\u00D7</button>' +
      '<div class="ps-stage"><canvas></canvas><p class="ps-loading" hidden>Preparing mockup\u2026</p></div>' +
      '<aside class="ps-side">' +
        '<p class="ps-eyebrow">Print studio \u2014 live preview</p>' +
        '<h3 class="ps-name"></h3>' +
        '<p class="ps-meta"></p>' +
        '<div class="ps-tabs"></div>' +
        '<label class="ps-scalewrap"><span class="ps-lab">Repeat scale</span>' +
          '<input class="ps-range" type="range" min="55" max="180" value="100" step="5">' +
          '<span class="ps-val">100%</span></label>' +
        '<p class="ps-note">Digital mockup \u2014 the print is applied in your browser. Repeat shown at 100% scale.</p>' +
        '<a class="ps-cta" href="mailto:lswesleydesigns@gmail.com?subject=Print%20enquiry">Enquire about this print</a>' +
      '</aside>' +
    '</div>';
  document.body.appendChild(root);

  var canvas  = root.querySelector("canvas");
  var ctx     = canvas.getContext("2d");
  var tabsBox = root.querySelector(".ps-tabs");
  var nameEl  = root.querySelector(".ps-name");
  var metaEl  = root.querySelector(".ps-meta");
  var noteEl  = root.querySelector(".ps-note");
  var range   = root.querySelector(".ps-range");
  var valEl   = root.querySelector(".ps-val");
  var loading = root.querySelector(".ps-loading");

  /* ---------- collect the archive prints ---------- */
  function collectPrints() {
    document.querySelectorAll(".fig").forEach(function (fig) {
      var im = fig.querySelector(".media img");
      var cap = fig.querySelector(".cap");
      if (!im || !cap) return;
      var full = cap.textContent.trim();               /* "P-03 — Bordeaux Damask · repeat…" */
      var dash = full.indexOf("\u2014");
      if (dash < 0) return;
      var code = full.slice(0, dash).trim();
      var rest = full.slice(dash + 1).trim();
      var dot  = rest.indexOf("\u00B7");
      var name = dot > -1 ? rest.slice(0, dot).trim() : rest;
      var meta = dot > -1 ? rest.slice(dot + 1).trim() : "";
      prints.push({ code: code, name: name, meta: meta, img: im });
    });
  }

  /* ---------- image helpers ---------- */
  function loadImg(src) {
    return new Promise(function (res, rej) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = rej;
      im.src = src;
    });
  }
  function preloadMocks() {
    return Promise.all(PRODUCTS.map(function (p) {
      if (mockImgs[p.id]) return Promise.resolve(mockImgs[p.id]);
      return loadImg(MOCK_DIR + p.file).then(function (im) { mockImgs[p.id] = im; return im; });
    }));
  }

  /* ---------- drape warp: shift rows horizontally with a soft wave ----------
     The wave grows toward the bottom of the zone, so hems swing like fabric. */
  function warp(tmp, amount) {
    if (amount <= 0) return;
    var w = tmp.width, h = tmp.height;
    var band = 4;                                   /* px per row band (perf) */
    for (var y = 0; y < h; y += band) {
      var t = y / h;                                /* 0 top -> 1 bottom */
      var amp = amount * w * 0.022 * t * t;         /* quadratic: more at hem */
      if (amp < 0.3) continue;
      var dx = Math.round(Math.sin(t * Math.PI * 2.2 + 0.7) * amp);
      if (!dx) continue;
      tmp.getContext("2d").drawImage(tmp, 0, y, w, band, dx, y, w, band);
    }
  }

  /* ---------- the render ---------- */
  function render() {
    var p = PRODUCTS[curProd];
    var base = mockImgs[p.id];
    if (!base) { loading.hidden = false; return; }
    loading.hidden = true;

    var W = 1200, H = Math.round(W * base.height / base.width);
    canvas.width = W; canvas.height = H;

    /* 1. the photo */
    ctx.drawImage(base, 0, 0, W, H);

    /* pattern tile */
    var printImg = prints[curPrint].img;
    var tileW = Math.max(24, Math.round(W * p.base * scale / 10000));  /* base% of W, scale% */
    var tileH = Math.round(tileW * printImg.naturalHeight / printImg.naturalWidth);
    var tile = document.createElement("canvas");
    tile.width = tileW; tile.height = tileH;
    tile.getContext("2d").drawImage(printImg, 0, 0, tileW, tileH);
    var pat = ctx.createPattern(tile, "repeat");

    /* zones -> pixel polygons */
    var polys = p.zones.map(function (pts) {
      return pts.reduce(function (acc, v, i) {
        acc.push(i % 2 === 0 ? v * W / 100 : v * H / 100);
        return acc;
      }, []);
    });

    function tracePoly(c, pts, ox, oy) {
      c.moveTo(pts[0] - ox, pts[1] - oy);
      for (var i = 2; i < pts.length; i += 2) c.lineTo(pts[i] - ox, pts[i + 1] - oy);
      c.closePath();
    }

    ctx.save();
    ctx.beginPath();
    polys.forEach(function (pts) { tracePoly(ctx, pts, 0, 0); });
    ctx.clip();

    polys.forEach(function (pts, zi) {
      /* bbox of this zone */
      var xs = pts.filter(function (_, i) { return i % 2 === 0; });
      var ys = pts.filter(function (_, i) { return i % 2 === 1; });
      var zx = Math.min.apply(null, xs), zy = Math.min.apply(null, ys);
      var zw = Math.max.apply(null, xs) - zx, zh = Math.max.apply(null, ys) - zy;

      /* print on its own layer, pattern phase kept from the canvas origin */
      var tmp = document.createElement("canvas");
      tmp.width = Math.max(2, Math.round(zw));
      tmp.height = Math.max(2, Math.round(zh));
      var tc = tmp.getContext("2d");
      tc.save();
      tc.translate(-Math.round(zx) % tileW, -Math.round(zy) % tileH);
      tc.fillStyle = pat;
      tc.fillRect(0, 0, tmp.width + tileW, tmp.height + tileH);
      tc.restore();

      /* mask: polygon + feathered edge */
      tc.globalCompositeOperation = "destination-in";
      try { tc.filter = "blur(" + Math.max(3, Math.round(tmp.width * 0.012)) + "px)"; } catch (e) {}
      tc.fillStyle = "#fff";
      tc.beginPath();
      tracePoly(tc, pts, zx, zy);
      tc.fill();
      try { tc.filter = "none"; } catch (e) {}
      tc.globalCompositeOperation = "source-over";

      warp(tmp, p.drape);
      ctx.drawImage(tmp, zx, zy);
    });

    /* 3. fabric texture: photo multiply darkens the print where it folds */
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(base, 0, 0, W, H);

    /* 4. highlight sheen: fold lights re-lighten the printed surface */
    if (p.sheen > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = p.sheen;
      ctx.drawImage(base, 0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ---------- UI wiring ---------- */
  function buildTabs() {
    tabsBox.innerHTML = "";
    PRODUCTS.forEach(function (p, i) {
      var b = document.createElement("button");
      b.className = "ps-tab" + (i === curProd ? " on" : "");
      b.textContent = p.label;
      b.addEventListener("click", function () { curProd = i; syncTabs(); render(); });
      tabsBox.appendChild(b);
    });
  }
  function syncTabs() {
    [].forEach.call(tabsBox.children, function (b, i) { b.classList.toggle("on", i === curProd); });
  }
  function fillInfo() {
    var pr = prints[curPrint];
    nameEl.textContent = pr.name;
    metaEl.textContent = pr.code + (pr.meta ? " \u00B7 " + pr.meta.replace(/^\u00B7\s*/, "") : "");
    noteEl.textContent = "Digital mockup \u2014 the print is applied in your browser." +
      (pr.meta.indexOf("64") > -1 ? " Repeat 64 \u00D7 64 cm at 100%." : " Repeat shown at 100% scale.");
    root.querySelector(".ps-cta").href =
      "mailto:lswesleydesigns@gmail.com?subject=" + encodeURIComponent("Print enquiry \u2014 " + pr.code + " " + pr.name);
  }
  function show(idx) {
    curPrint = idx; open = true;
    root.hidden = false;
    document.body.classList.add("locked");
    fillInfo(); buildTabs();
    loading.hidden = false;
    preloadMocks().then(render).catch(function () { loading.hidden = true; });
  }
  function hide() {
    open = false; root.hidden = true;
    document.body.classList.remove("locked");
  }

  range.addEventListener("input", function () {
    scale = +range.value;
    valEl.textContent = scale + "%";
    if (mockImgs[PRODUCTS[curProd].id]) render();
  });
  root.addEventListener("click", function (e) { if (e.target.closest("[data-ps-close]")) hide(); });
  document.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") hide();
    if (e.key === "ArrowRight") { curProd = (curProd + 1) % PRODUCTS.length; syncTabs(); render(); }
    if (e.key === "ArrowLeft")  { curProd = (curProd + PRODUCTS.length - 1) % PRODUCTS.length; syncTabs(); render(); }
  });

  /* ---------- hijack archive figure clicks (before the lightbox) ---------- */
  document.addEventListener("click", function (e) {
    var fig = e.target.closest && e.target.closest(".fig");
    if (!fig) return;
    var im = fig.querySelector(".media img");
    var idx = prints.findIndex(function (p) { return p.img === im; });
    if (idx < 0) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    show(idx);
  }, true);

  collectPrints();
})();
