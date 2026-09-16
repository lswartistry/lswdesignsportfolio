/* ==========================================================================
   PRINT STUDIO v6.8 — Patternbank-style product try-on + COLOURWAYS
   v6.1: solidifyMask() — mask interiors forced fully opaque so the white
   product photo can't ghost through dark prints (rug streak, dress/bikini
   veil). Edge anti-aliasing preserved. Pair with repaired mask-rug.png.
   v6.2: edge-aware highlight suppression in buildLighting() — kills the fake
   white halos the screen pass painted around strong photo edges (wallpaper
   ladder/plant/baseboard). Soft shading + fine texture untouched.
   v6.3: watermark overlay — assets/img/Watermark.png drawn cover-fit on top
   of every popup mockup (canvas) + over grid thumbnails (CSS ::after).
   v6.4: faint dark offset copy behind the watermark logos (canvas + CSS
   ::before) so the white mark also reads on light prints.
   v6.5: homepage-teaser scoping — collectPrints() binds only inside
   #studio when present (About portrait stays a plain image); watermark
   CSS scoped to .work-group (studio page) + #studio (homepage).
   v6.6: popup layout is CSS-only (no JS change) — fixed popup height on
   desktop so switching products never resizes it; airier side-panel
   section spacing.
   v6.8: two new product tabs — Thermal bottle (mask = body only, cap stays
   blank) + Phone case (camera island cut out of the mask). Pair with
   mock-bottle.jpg / mock-phone.jpg and mask-bottle.png / mask-phone.png.
   Same engine as v5 (mask clip + fabric-lighting transfer), plus:
   - Any <figure class="fig"> can declare colourways via data attributes:

       <figure class="fig ..." data-cursor="View"
         data-colourways="Natural|Noir|Terracotta"
         data-colourways-src="assets/img/Print-11A.jpg|assets/img/Print-11B.jpg|assets/img/Print-11C.jpg">
         <div class="media"><img src="assets/img/Print-11A.jpg" ...></div>
         <figcaption class="cap"><b>P-11</b> — Name · repeat 64 × 64 cm</figcaption>
       </figure>

     * data-colourways     = display names, separated by |
     * data-colourways-src = one JPG per colourway, separated by |, same order
     * The grid <img> should be the first colourway (colourway A).
     * Prints WITHOUT these attributes behave exactly as before (v5).

   - Also accepts US spelling: data-colorways / data-colorways-src.
   - Also accepts JSON: data-colourways='[{"name":"Natural","src":"..."}]'
   ========================================================================== */
(function () {
  "use strict";

  /* mask : alpha cutout of the product (white PNG w/ alpha), same framing as file
     base : repeat width at 100% scale, % of photo width
     drape: 0..1  subtle pattern bend with the folds
     fabric: 0..1 strength of the fabric-lighting transfer            */
  var PRODUCTS = [
    { id: "wallpaper", label: "Wallpaper",     file: "mock-wallpaper.jpg", mask: "mask-wallpaper.png",               base: 30, drape: 0,    fabric: 0.25 },
    { id: "dress",     label: "Dress",         file: "mock-dress.jpg",     mask: "mask-dress.png",   base: 28, drape: 0.5,  fabric: 1.0 },
    { id: "bikini",    label: "Bikini",        file: "mock-bikini.jpg",    mask: "mask-bikini.png",  base: 22, drape: 0.4,  fabric: 1.0 },
    { id: "cushion",   label: "Cushion 45×45", file: "mock-cushion.jpg", mask: "mask-cushion.png", base: 38, drape: 0,  fabric: 0.9 },
    { id: "tote",      label: "Tote bag",      file: "mock-tote.jpg",      mask: "mask-tote.png",    base: 26, drape: 0,    fabric: 0.85 },
    { id: "notebook",  label: "Notebook A5",   file: "mock-notebook.jpg",  mask: "mask-notebook.png",base: 40, drape: 0,    fabric: 0.3 },
    { id: "rug",       label: "Rug",           file: "mock-rug.jpg",       mask: "mask-rug.png",     base: 34, drape: 0,    fabric: 0.6 },
    { id: "bottle",    label: "Thermal bottle", file: "mock-bottle.jpg",    mask: "mask-bottle.png",  base: 30, drape: 0,    fabric: 0.85 },
    { id: "phone",     label: "Phone case",    file: "mock-phone.jpg",     mask: "mask-phone.png",   base: 35, drape: 0,    fabric: 0.4 }
  ];
  var MOCK_DIR = "assets/img/mockups/";
  var MASK_DIR = "assets/img/masks/";
  var WM_SRC = "assets/img/Watermark.png";

  /* ---------- state ---------- */
  var prints = [], curPrint = 0, curProd = 0, curCW = 0, scale = 100;
  var mockImgs = {}, maskImgs = {}, lightCache = {}, open = false;
  var wmImg = null, wmTried = false, wmShadow = null;

  /* ---------- build the popup once ---------- */
  var root = document.createElement("div");
  root.className = "pstudio";
  root.hidden = true;
  root.innerHTML =
    '<div class="ps-backdrop" data-ps-close></div>' +
    '<div class="ps-panel" role="dialog" aria-modal="true" aria-label="Print studio">' +
      '<button class="ps-close" data-ps-close aria-label="Close">×</button>' +
      '<div class="ps-stage"><canvas></canvas><p class="ps-loading" hidden>Preparing mockup…</p></div>' +
      '<aside class="ps-side">' +
       '<div class="ps-view ps-view-info">' +
        '<p class="ps-eyebrow">Print studio — live preview</p>' +
        '<h3 class="ps-name"></h3>' +
        '<p class="ps-meta"></p>' +
        '<div class="ps-cw" hidden>' +
          '<p class="ps-cw-top"><span class="ps-lab">Colourway</span>' +
          '<span class="ps-cw-name"></span></p>' +
          '<div class="ps-swatches" role="listbox" aria-label="Colourways"></div>' +
        '</div>' +
        '<div class="ps-tabs"></div>' +
        '<label class="ps-scalewrap"><span class="ps-lab">Repeat scale</span>' +
          '<input class="ps-range" type="range" min="55" max="300" value="100" step="5">' +
          '<span class="ps-val">100%</span></label>' +
        '<p class="ps-note">Digital mockup — the print is applied in your browser. Repeat shown at 100% scale.</p>' +
        '<button class="ps-cta" type="button">Enquire about this print</button>' +
       '</div>' +
       '<form class="ps-view ps-form" hidden novalidate>' +
          '<p class="ps-eyebrow">Print enquiry</p>' +
          '<h3 class="ps-name2"></h3>' +
          '<div class="ps-field"><label for="ps-name">Your name</label>' +
            '<input id="ps-name" name="name" type="text" autocomplete="name" placeholder="Your name"></div>' +
          '<div class="ps-field"><label for="ps-email">Email</label>' +
            '<input id="ps-email" name="email" type="email" autocomplete="email" placeholder="you@studio.com" required></div>' +
          '<div class="ps-field"><label for="ps-msg">Message</label>' +
            '<textarea id="ps-msg" name="message" rows="6"></textarea></div>' +
          '<input type="hidden" name="_subject" value="">' +
          '<input type="text" name="_gotcha" class="ps-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
          '<button class="ps-send" type="submit">Send enquiry</button>' +
          '<button class="ps-back" type="button">← Back to the print</button>' +
          '<p class="ps-ok" hidden>Thank you — your enquiry is on its way. I’ll get back to you within two working days.</p>' +
          '<p class="ps-err" hidden>Something went wrong — please email lswesleydesigns@gmail.com directly.</p>' +
        '</form>' +
      '</aside>' +
    '</div>';
  document.body.appendChild(root);

  var canvas  = root.querySelector("canvas");
  var ctx     = canvas.getContext("2d");
  var tabsBox = root.querySelector(".ps-tabs");
  var nameEl  = root.querySelector(".ps-name");
  var metaEl  = root.querySelector(".ps-meta");
  var cwBox   = root.querySelector(".ps-cw");
  var cwName  = root.querySelector(".ps-cw-name");
  var swBox   = root.querySelector(".ps-swatches");
  var noteEl  = root.querySelector(".ps-note");
  var range   = root.querySelector(".ps-range");
  var valEl   = root.querySelector(".ps-val");
  var loading = root.querySelector(".ps-loading");
  var viewInfo = root.querySelector(".ps-view-info");
  var form     = root.querySelector(".ps-form");
  var name2El  = root.querySelector(".ps-name2");
  var sendBtn  = root.querySelector(".ps-send");

  /* ---------- helpers ---------- */
  function loadImg(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () { res(im); };
      im.onerror = function () { res(null); };
      im.src = src;
    });
  }
  function mkCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }
  /* Solidify mask interiors: some cutouts are only 80-90% opaque (or have
     weak streaks), letting the white product photo ghost through dark prints.
     Alpha <=24 -> transparent, >=140 -> fully opaque, smooth ramp between
     so edge anti-aliasing and thin straps/strings are preserved. */
  function solidifyMask(im) {
    try {
      var w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
      if (!w || !h) return im;
      var c = mkCanvas(w, h);
      var cx = c.getContext("2d");
      cx.drawImage(im, 0, 0);
      var id = cx.getImageData(0, 0, w, h), d = id.data;
      for (var i = 3; i < d.length; i += 4) {
        var a = d[i];
        if (a <= 24) d[i] = 0;
        else if (a >= 140) d[i] = 255;
        else { var t = (a - 24) / 116; t = t * t * (3 - 2 * t); d[i] = Math.round(t * 255); }
      }
      cx.putImageData(id, 0, 0);
      return c;
    } catch (e) { return im; }
  }
  function splitPipe(s) {
    return String(s || "").split("|").map(function (x) { return x.trim(); }).filter(function (x) { return x.length; });
  }
  function imgReady(im) {
    return !!(im && im.naturalWidth > 0 && im.naturalHeight > 0);
  }

  /* Parse colourways from a <figure>. Returns array of {name, src} or null. */
  function parseColourways(fig, fallbackSrc) {
    var rawLabels = fig.getAttribute("data-colourways") || fig.getAttribute("data-colorways") || "";
    var rawSrcs = fig.getAttribute("data-colourways-src") || fig.getAttribute("data-colorways-src") ||
                  fig.getAttribute("data-colourway-src") || fig.getAttribute("data-colorway-src") || "";

    rawLabels = rawLabels.trim();

    /* JSON form: data-colourways='[{"name":"...","src":"..."}]' */
    if (rawLabels.charAt(0) === "[") {
      try {
        var arr = JSON.parse(rawLabels);
        if (Array.isArray(arr) && arr.length) {
          return arr.map(function (v, i) {
            return {
              name: (v.name || v.label || ("Colourway " + (i + 1))).toString(),
              src: (v.src || fallbackSrc).toString()
            };
          }).filter(function (v) { return !!v.src; });
        }
      } catch (e) { /* fall through to pipe parsing */ }
    }

    var labels = splitPipe(rawLabels);
    var srcs = splitPipe(rawSrcs);

    /* srcs only (no labels) -> auto labels A, B, C… */
    if (!labels.length && srcs.length) {
      labels = srcs.map(function (_, i) { return "Colourway " + String.fromCharCode(65 + i); });
    }
    /* labels only (no srcs) -> can't build variants, ignore */
    if (!srcs.length) return null;
    /* pad labels if fewer than srcs */
    while (labels.length < srcs.length) labels.push("Colourway " + String.fromCharCode(65 + labels.length));

    return srcs.map(function (s, i) { return { name: labels[i], src: s }; });
  }

  /* ---------- collect the archive prints ----------
     v6.5: scoped — on pages with a #studio section (homepage teaser) only
     figs inside it become try-on prints, so other page images (e.g. the
     About portrait, also a .fig) never open the popup. */
  function collectPrints() {
    var scope = document.getElementById("studio");
    var figs = scope ? scope.querySelectorAll(".fig") : document.querySelectorAll(".fig");
    figs.forEach(function (fig) {
      var im = fig.querySelector(".media img");
      var cap = fig.querySelector(".cap");
      if (!im || !cap) return;
      var full = cap.textContent.trim();
      var dash = full.indexOf("—");
      if (dash < 0) return;
      var code = full.slice(0, dash).trim();
      var rest = full.slice(dash + 1).trim();
      var dot  = rest.indexOf("·");
      var gridSrc = im.getAttribute("src") || im.src;

      var entry = {
        code: code,
        name: dot > -1 ? rest.slice(0, dot).trim() : rest,
        meta: dot > -1 ? rest.slice(dot + 1).trim() : "",
        img: im,
        variants: null /* filled below */
      };

      var cw = parseColourways(fig, gridSrc);
      if (cw && cw.length > 1) {
        entry.variants = cw.map(function (v, i) {
          /* Reuse the grid <img> for variant 0 when srcs match (instant, no reload) */
          var sameAsGrid = (i === 0) && (v.src === gridSrc || gridSrc.indexOf(v.src) > -1 || v.src.indexOf(gridSrc.split("/").pop()) > -1);
          return { name: v.name, src: v.src, img: sameAsGrid ? im : null };
        });
      } else {
        entry.variants = [{ name: "", src: gridSrc, img: im }];
      }
      prints.push(entry);
    });
  }

  function preloadAssets() {
    return Promise.all(PRODUCTS.map(function (p) {
      var jobs = [];
      if (!mockImgs[p.id]) {
        jobs.push(loadImg(MOCK_DIR + p.file).then(function (im) { mockImgs[p.id] = im; }));
      }
      if (p.mask && !maskImgs[p.id]) {
        jobs.push(loadImg(MASK_DIR + p.mask).then(function (im) { maskImgs[p.id] = im ? solidifyMask(im) : im; }));
      }
      return Promise.all(jobs);
    }));
  }

  /* Preload all colourway JPGs for the open print (so switching is instant) */
  function preloadVariants(pr) {
    return Promise.all(pr.variants.map(function (v) {
      if (imgReady(v.img)) return Promise.resolve();
      return loadImg(v.src).then(function (im) { if (im) v.img = im; });
    }));
  }

  function activeVariant() {
    var pr = prints[curPrint];
    return pr.variants[Math.min(curCW, pr.variants.length - 1)];
  }

  /* ---------- fabric lighting map (normalised fold shading) ---------- */
  function buildLighting(base) {
    try {
      var w = 220, h = Math.max(2, Math.round(220 * base.height / base.width));
      var c = mkCanvas(w, h);
      var cx = c.getContext("2d");
      cx.drawImage(base, 0, 0, w, h);
      var d = cx.getImageData(0, 0, w, h).data;

      var bw = Math.max(2, Math.round(w / 6)), bh = Math.max(2, Math.round(h / 6));
      var c2 = mkCanvas(bw, bh);
      c2.getContext("2d").drawImage(c, 0, 0, bw, bh);
      var c3 = mkCanvas(w, h);
      c3.getContext("2d").drawImage(c2, 0, 0, w, h);
      var d2 = c3.getContext("2d").getImageData(0, 0, w, h).data;

      /* v6.2: edge-aware highlight mask. The lum/baseline ratio produces fake
         "highlights" ringing strong photo edges (ladder, plant, baseboard),
         which screen onto dark prints as white halos. Detect edges (Sobel on
         luminance), dilate ~4px, and suppress the screen map there. Soft
         shading and fine texture (low gradient) are untouched. */
      var lumA = new Float32Array(w * h), k, px;
      for (k = 0, px = 0; k < lumA.length; k++, px += 4) {
        lumA[k] = (0.299 * d[px] + 0.587 * d[px + 1] + 0.114 * d[px + 2]) / 255;
      }
      function lumAt(x, y) {
        x = x < 0 ? 0 : (x > w - 1 ? w - 1 : x);
        y = y < 0 ? 0 : (y > h - 1 ? h - 1 : y);
        return lumA[y * w + x];
      }
      var edge = new Float32Array(w * h);
      for (var ey = 0; ey < h; ey++) {
        for (var ex = 0; ex < w; ex++) {
          var gx = -lumAt(ex - 1, ey - 1) + lumAt(ex + 1, ey - 1) +
                   -2 * lumAt(ex - 1, ey) + 2 * lumAt(ex + 1, ey) +
                   -lumAt(ex - 1, ey + 1) + lumAt(ex + 1, ey + 1);
          var gy = -lumAt(ex - 1, ey - 1) - 2 * lumAt(ex, ey - 1) - lumAt(ex + 1, ey - 1) +
                   lumAt(ex - 1, ey + 1) + 2 * lumAt(ex, ey + 1) + lumAt(ex + 1, ey + 1);
          var m = Math.sqrt(gx * gx + gy * gy) / 4;
          var t = (m - 0.06) / 0.20;
          t = t < 0 ? 0 : (t > 1 ? 1 : t);
          edge[ey * w + ex] = t * t * (3 - 2 * t);
        }
      }
      var dil = new Float32Array(w * h), R = 4;
      for (var dy = 0; dy < h; dy++) {
        for (var dx = 0; dx < w; dx++) {
          var mx = 0;
          for (var oy = -R; oy <= R; oy++) {
            var yy = dy + oy;
            if (yy < 0 || yy >= h) continue;
            for (var ox = -R; ox <= R; ox++) {
              var xx = dx + ox;
              if (xx < 0 || xx >= w) continue;
              var v = edge[yy * w + xx];
              if (v > mx) mx = v;
            }
          }
          dil[dy * w + dx] = mx;
        }
      }

      var A = cx.createImageData(w, h);
      var B = cx.createImageData(w, h);
      for (var i = 0, j = 0; i < d.length; i += 4, j++) {
        var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        var bas = 0.299 * d2[i] + 0.587 * d2[i + 1] + 0.114 * d2[i + 2];
        var sh = lum / Math.max(10, bas);
        sh = Math.max(0.45, Math.min(1.6, sh));
        A.data[i] = A.data[i + 1] = A.data[i + 2] = Math.min(sh, 1) * 255; A.data[i + 3] = 255;
        B.data[i] = B.data[i + 1] = B.data[i + 2] = Math.max(sh - 1, 0) * (1 - dil[j]) * 255; B.data[i + 3] = 255;
      }
      var cA = mkCanvas(w, h); cA.getContext("2d").putImageData(A, 0, 0);
      var cB = mkCanvas(w, h); cB.getContext("2d").putImageData(B, 0, 0);
      return { mult: cA, scr: cB };
    } catch (e) { return null; }
  }

  /* ---------- subtle drape: shift rows of the pattern with a soft wave ---------- */
  function warp(tmp, amount) {
    if (amount <= 0) return;
    var w = tmp.width, h = tmp.height;
    var band = 4;
    for (var y = 0; y < h; y += band) {
      var t = y / h;
      var amp = amount * w * 0.02 * t * t;
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

    var v = activeVariant();
    var printImg = v.img || prints[curPrint].img;
    if (!imgReady(printImg)) {
      /* Variant still loading — fetch it, then re-render */
      loading.hidden = false;
      loadImg(v.src).then(function (im) {
        if (im) v.img = im;
        if (open) render();
      });
      return;
    }
    loading.hidden = true;

    var W = 1200, H = Math.round(W * base.height / base.width);
    canvas.width = W; canvas.height = H;

    /* 1. the photo */
    ctx.drawImage(base, 0, 0, W, H);

    /* 2. the print, tiled at the chosen scale */
    var tileW = Math.max(24, Math.round(W * p.base * scale / 10000));
    var tileH = Math.round(tileW * printImg.naturalHeight / printImg.naturalWidth);
    var tile = mkCanvas(tileW, tileH);
    tile.getContext("2d").drawImage(printImg, 0, 0, tileW, tileH);

    var tmp = mkCanvas(W, H);
    var tc = tmp.getContext("2d");
    tc.fillStyle = ctx.createPattern(tile, "repeat");
    tc.fillRect(0, 0, W, H);
    warp(tmp, p.drape || 0);

    /* 3. THE PATTERNBANK STEP: clip the print by the product's alpha mask */
    var mask = p.mask ? maskImgs[p.id] : null;
    if (mask) {
      tc.globalCompositeOperation = "destination-in";
      tc.drawImage(mask, 0, 0, W, H);
      tc.globalCompositeOperation = "source-over";
    }
    ctx.drawImage(tmp, 0, 0);

    /* 4. macro shading + 5. fabric-lighting transfer through the print */
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.45;
    ctx.drawImage(base, 0, 0, W, H);

    var L = lightCache[p.id] || (lightCache[p.id] = buildLighting(base));
    if (L) {
      ctx.globalAlpha = p.fabric;
      ctx.drawImage(L.mult, 0, 0, W, H);
      ctx.globalCompositeOperation = "screen";
      ctx.drawImage(L.scr, 0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* #debug: tint the mask cutout */
    if (location.hash.indexOf("debug") > -1 && mask) {
      var tint = mkCanvas(mask.width, mask.height);
      var tx = tint.getContext("2d");
      tx.drawImage(mask, 0, 0);
      tx.globalCompositeOperation = "source-in";
      tx.fillStyle = "rgba(232,54,143,.45)";
      tx.fillRect(0, 0, tint.width, tint.height);
      ctx.drawImage(tint, 0, 0, W, H);
    }

    /* v6.4: watermark overlay (cover-fit, topmost): faint dark offset copy
       behind the white logos so the mark also reads on light prints.
       Loads once; if missing, the popup simply renders without it. */
    if (wmImg) {
      var iw = wmImg.naturalWidth || wmImg.width, ih = wmImg.naturalHeight || wmImg.height;
      if (iw && ih) {
        var s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
        var dx = (W - dw) / 2, dy = (H - dh) / 2;
        if (!wmShadow) {
          try {
            var sc = mkCanvas(iw, ih), sx = sc.getContext("2d");
            sx.drawImage(wmImg, 0, 0);
            sx.globalCompositeOperation = "source-in";
            sx.fillStyle = "#000";
            sx.fillRect(0, 0, iw, ih);
            wmShadow = sc;
          } catch (e) { wmShadow = false; }
        }
        if (wmShadow) {
          var ox = Math.max(1, Math.round(W * 0.0018)), oy = Math.max(2, Math.round(W * 0.0025));
          ctx.globalAlpha = 0.38;
          ctx.drawImage(wmShadow, dx + ox, dy + oy, dw, dh);
          ctx.globalAlpha = 1;
        }
        ctx.drawImage(wmImg, dx, dy, dw, dh);
      }
    } else if (!wmTried) {
      wmTried = true;
      loadImg(WM_SRC).then(function (im) { if (im) { wmImg = im; if (open) render(); } });
    }
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

  /* ----- colourway swatches ----- */
  function buildCW() {
    var pr = prints[curPrint];
    if (!pr.variants || pr.variants.length < 2) { cwBox.hidden = true; swBox.innerHTML = ""; return; }
    cwBox.hidden = false;
    swBox.innerHTML = "";
    pr.variants.forEach(function (v, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ps-sw" + (i === curCW ? " on" : "");
      b.setAttribute("role", "option");
      b.setAttribute("aria-selected", i === curCW ? "true" : "false");
      b.title = v.name;
      var thumb = document.createElement("img");
      thumb.src = v.src;
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.decoding = "async";
      var lab = document.createElement("span");
      lab.textContent = v.name;
      b.appendChild(thumb);
      b.appendChild(lab);
      b.addEventListener("click", function () {
        if (curCW === i) return;
        curCW = i;
        syncCW();
        fillInfo();
        render();
      });
      swBox.appendChild(b);
    });
    syncCW();
  }
  function syncCW() {
    var pr = prints[curPrint];
    if (!pr.variants || pr.variants.length < 2) return;
    cwName.textContent = "— " + pr.variants[curCW].name;
    [].forEach.call(swBox.children, function (b, i) {
      b.classList.toggle("on", i === curCW);
      b.setAttribute("aria-selected", i === curCW ? "true" : "false");
    });
  }

  function cwSuffix() {
    var pr = prints[curPrint];
    if (pr.variants && pr.variants.length > 1) return " — " + pr.variants[curCW].name;
    return "";
  }

  function fillInfo() {
    var pr = prints[curPrint];
    nameEl.textContent = pr.name;
    metaEl.textContent = pr.code + (pr.meta ? " · " + pr.meta.replace(/^·\s*/, "") : "");
    noteEl.textContent = "Digital mockup — the print is applied in your browser." +
      (pr.meta.indexOf("64") > -1 ? " Repeat 64 × 64 cm at 100%." : " Repeat shown at 100% scale.");

    /* enquiry form: subject + pre-filled message (includes colourway) */
    var fullName = pr.code + " " + pr.name + cwSuffix();
    form.querySelector('[name="_subject"]').value = "Print enquiry — " + fullName;
    name2El.textContent = pr.code + " — " + pr.name + cwSuffix();
    form.querySelector("[name=message]").value =
      "Hi Loriel,\n\nI’d like to know more about " + pr.code + " — " + pr.name + cwSuffix() +
      " (from your Print Studio).\nI’m interested in using it for: ";
  }
  function showForm() {
    viewInfo.hidden = true;
    form.hidden = false;
  }
  function showInfo() {
    form.hidden = true;
    viewInfo.hidden = false;
  }

  root.querySelector(".ps-cta").addEventListener("click", showForm);
  root.querySelector(".ps-back").addEventListener("click", showInfo);

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var email = form.querySelector("[name=email]");
    if (!email.value.trim() || !email.checkValidity()) {
      email.focus();
      email.setAttribute("aria-invalid", "true");
      return;
    }
    email.removeAttribute("aria-invalid");

    var btn = sendBtn;
    btn.disabled = true;
    btn.dataset.label = btn.textContent;
    btn.textContent = "Sending…";
    form.querySelector(".ps-ok").hidden = true;
    form.querySelector(".ps-err").hidden = true;

    fetch("https://formspree.io/f/maewdrlg", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(form)
    }).then(function (r) {
      if (!r.ok) throw new Error("bad status");
      form.querySelectorAll(".ps-field, .ps-send").forEach(function (el) { el.style.display = "none"; });
      form.querySelector(".ps-ok").hidden = false;
    }).catch(function () {
      btn.disabled = false;
      btn.textContent = btn.dataset.label || "Send enquiry";
      form.querySelector(".ps-err").hidden = false;
    });
  });

  function show(idx) {
    curPrint = idx; curCW = 0; open = true;
    root.hidden = false;
    document.body.classList.add("locked");
    fillInfo(); buildCW(); buildTabs(); showInfo();
    loading.hidden = false;
    /* restore enquiry form if it was sent before */
    form.querySelectorAll(".ps-field, .ps-send").forEach(function (el) { el.style.display = ""; });
    form.querySelector(".ps-ok").hidden = true;
    form.querySelector(".ps-err").hidden = true;
    sendBtn.disabled = false;
    sendBtn.textContent = sendBtn.dataset.label || "Send enquiry";
    Promise.all([preloadAssets(), preloadVariants(prints[curPrint])]).then(render);
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
