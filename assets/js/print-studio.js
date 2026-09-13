/* ==========================================================================
   PRINT STUDIO v5 — Patternbank-style product try-on
   Architecture (same as Patternbank's product views): every mockup photo
   ships with a pre-cut ALPHA MASK (mask-<product>.png). The pattern is
   tiled in the browser, clipped by that mask (destination-in), then a
   fabric-lighting map (fold shadows / weave / highlights, normalised from
   the photo) is applied THROUGH the print. Result: the print sits inside
   the product, at its true silhouette, at any repeat scale.
   Swap a mockup photo or mask anytime - same filename, zero code changes.
   #debug in the URL tints the mask so you can check the cutout.
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
    { id: "cushion",   label: "Cushion 45\u00D745", file: "mock-cushion.jpg", mask: "mask-cushion.png", base: 38, drape: 0,  fabric: 0.9 },
    { id: "tote",      label: "Tote bag",      file: "mock-tote.jpg",      mask: "mask-tote.png",    base: 26, drape: 0,    fabric: 0.85 },
    { id: "notebook",  label: "Notebook A5",   file: "mock-notebook.jpg",  mask: "mask-notebook.png",base: 40, drape: 0,    fabric: 0.3 },
    { id: "rug",       label: "Rug",           file: "mock-rug.jpg",       mask: "mask-rug.png",     base: 34, drape: 0,    fabric: 0.6 }
  ];
  var MOCK_DIR = "assets/img/mockups/";
  var MASK_DIR = "assets/img/masks/";

  /* ---------- state ---------- */
  var prints = [], curPrint = 0, curProd = 0, scale = 100;
  var mockImgs = {}, maskImgs = {}, lightCache = {}, open = false;

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
       '<div class="ps-view ps-view-info">' +
        '<p class="ps-eyebrow">Print studio \u2014 live preview</p>' +
        '<h3 class="ps-name"></h3>' +
        '<p class="ps-meta"></p>' +
        '<div class="ps-tabs"></div>' +
        '<label class="ps-scalewrap"><span class="ps-lab">Repeat scale</span>' +
          '<input class="ps-range" type="range" min="55" max="300" value="100" step="5">' +
          '<span class="ps-val">100%</span></label>' +
        '<p class="ps-note">Digital mockup \u2014 the print is applied in your browser. Repeat shown at 100% scale.</p>' +
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
          '<button class="ps-back" type="button">\u2190 Back to the print</button>' +
          '<p class="ps-ok" hidden>Thank you \u2014 your enquiry is on its way. I\u2019ll get back to you within two working days.</p>' +
          '<p class="ps-err" hidden>Something went wrong \u2014 please email lswesleydesigns@gmail.com directly.</p>' +
        '</form>' +
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
  var viewInfo = root.querySelector(".ps-view-info");
  var form     = root.querySelector(".ps-form");
  var name2El  = root.querySelector(".ps-name2");
  var sendBtn  = root.querySelector(".ps-send");

  /* ---------- collect the archive prints ---------- */
  function collectPrints() {
    document.querySelectorAll(".fig").forEach(function (fig) {
      var im = fig.querySelector(".media img");
      var cap = fig.querySelector(".cap");
      if (!im || !cap) return;
      var full = cap.textContent.trim();
      var dash = full.indexOf("\u2014");
      if (dash < 0) return;
      var code = full.slice(0, dash).trim();
      var rest = full.slice(dash + 1).trim();
      var dot  = rest.indexOf("\u00B7");
      prints.push({
        code: code,
        name: dot > -1 ? rest.slice(0, dot).trim() : rest,
        meta: dot > -1 ? rest.slice(dot + 1).trim() : "",
        img: im
      });
    });
  }

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
  function preloadAssets() {
    return Promise.all(PRODUCTS.map(function (p) {
      var jobs = [];
      if (!mockImgs[p.id]) {
        jobs.push(loadImg(MOCK_DIR + p.file).then(function (im) { mockImgs[p.id] = im; }));
      }
      if (p.mask && !maskImgs[p.id]) {
        jobs.push(loadImg(MASK_DIR + p.mask).then(function (im) { maskImgs[p.id] = im; }));
      }
      return Promise.all(jobs);
    }));
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

      var A = cx.createImageData(w, h);
      var B = cx.createImageData(w, h);
      for (var i = 0; i < d.length; i += 4) {
        var lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        var bas = 0.299 * d2[i] + 0.587 * d2[i + 1] + 0.114 * d2[i + 2];
        var sh = lum / Math.max(10, bas);
        sh = Math.max(0.45, Math.min(1.6, sh));
        A.data[i] = A.data[i + 1] = A.data[i + 2] = Math.min(sh, 1) * 255; A.data[i + 3] = 255;
        B.data[i] = B.data[i + 1] = B.data[i + 2] = Math.max(sh - 1, 0) * 255; B.data[i + 3] = 255;
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
    loading.hidden = true;

    var W = 1200, H = Math.round(W * base.height / base.width);
    canvas.width = W; canvas.height = H;

    /* 1. the photo */
    ctx.drawImage(base, 0, 0, W, H);

    /* 2. the print, tiled at the chosen scale */
    var printImg = prints[curPrint].img;
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

    /* enquiry form: subject + pre-filled message */
    form.querySelector('[name="_subject"]').value = "Print enquiry \u2014 " + pr.code + " " + pr.name;
    name2El.textContent = pr.code + " \u2014 " + pr.name;
    form.querySelector("[name=message]").value =
      "Hi Loriel,\n\nI\u2019d like to know more about " + pr.code + " \u2014 " + pr.name +
      " (from your Print Studio).\nI\u2019m interested in using it for: ";
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
    btn.textContent = "Sending\u2026";
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
    curPrint = idx; open = true;
    root.hidden = false;
    document.body.classList.add("locked");
    fillInfo(); buildTabs(); showInfo();
    loading.hidden = false;
    preloadAssets().then(render);
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
