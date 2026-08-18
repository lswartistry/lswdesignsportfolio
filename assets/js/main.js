(function(){
  "use strict";
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(pointer: fine)').matches;

  /* ---------- scroll progress + masthead ---------- */
  var progress = document.getElementById('progress');
  var masthead = document.getElementById('masthead');
  var lastY = 0;
  function onScroll(){
    var st = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (h > 0 ? (st / h) * 100 : 0) + '%';
    if (st > 90){ masthead.classList.add('scrolled'); } else { masthead.classList.remove('scrolled'); }
    if (!reduced){
      if (st > lastY && st > 320){ masthead.classList.add('hidden'); }
      else { masthead.classList.remove('hidden'); }
    }
    lastY = st;
  }
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  /* ---------- menu overlay ---------- */
  var overlay = document.getElementById('overlay');
  var menuBtn = document.getElementById('menuBtn');
  function toggleMenu(open){
    overlay.classList.toggle('open', open);
    document.body.classList.toggle('locked', open);
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  menuBtn.addEventListener('click', function(){ toggleMenu(!overlay.classList.contains('open')); });
  document.getElementById('menuClose').addEventListener('click', function(){ toggleMenu(false); });
  overlay.querySelectorAll('a').forEach(function(a){ a.addEventListener('click', function(){ toggleMenu(false); }); });

  /* ---------- reveal on scroll ---------- */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -8% 0px'}) : null;
  if (io){
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
    document.querySelectorAll('.media').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal,.media').forEach(function(el){ el.classList.add('in'); });
  }

  /* ---------- cursor follower ---------- */
  var cursor = document.getElementById('cursor');
  if (fine && !reduced){
    var mx=0,my=0,cx=0,cy=0;
    document.addEventListener('mousemove', function(e){ mx=e.clientX; my=e.clientY; });
    function loop(){
      cx += (mx-cx)*0.16; cy += (my-cy)*0.16;
      cursor.style.transform = 'translate3d('+cx+'px,'+cy+'px,0) translate(-50%,-160%) scale('+ (cursor.classList.contains('on')?1:0.7) +')';
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    document.querySelectorAll('[data-cursor]').forEach(function(el){
      el.addEventListener('mouseenter', function(){ cursor.textContent = el.getAttribute('data-cursor'); cursor.classList.add('on'); });
      el.addEventListener('mouseleave', function(){ cursor.classList.remove('on'); });
    });
  } else {
    cursor.style.display = 'none';
  }

  /* ---------- horizontal drag galleries ---------- */
  document.querySelectorAll('.drag').forEach(function(track){
    var bar = document.getElementById(track.id + 'Bar');
    var count = document.getElementById(track.id + 'Count');
    var slides = track.querySelectorAll('.slide');
    var wrap = track.closest('.bleed');
    var prev = wrap ? wrap.querySelector('[data-prev]') : null;
    var next = wrap ? wrap.querySelector('[data-next]') : null;
    var idx = 0;

    function update(){
      var max = track.scrollWidth - track.clientWidth;
      var pct = max > 0 ? (track.scrollLeft / max) * 100 : 0;
      if (bar) bar.style.width = Math.max(pct, 2) + '%';
      var w = slides[0] ? slides[0].offsetWidth + parseFloat(getComputedStyle(track).columnGap || 16) : 300;
      idx = Math.round(track.scrollLeft / w);
      if (count) count.textContent = String(idx+1).padStart(2,'0') + ' / ' + String(slides.length).padStart(2,'0');
    }
    track.addEventListener('scroll', function(){ requestAnimationFrame(update); }, {passive:true});
    if (prev) prev.addEventListener('click', function(){ track.scrollBy({left:-track.clientWidth*0.8, behavior:'smooth'}); });
    if (next) next.addEventListener('click', function(){ track.scrollBy({left: track.clientWidth*0.8, behavior:'smooth'}); });

    /* drag to scroll */
    var down=false, startX=0, startL=0, moved=false;
    track.addEventListener('pointerdown', function(e){
      if (e.pointerType !== 'mouse') return;
      down=true; moved=false; startX=e.clientX; startL=track.scrollLeft;
      track.classList.add('dragging');
      delete track.dataset.moved;
    });
    window.addEventListener('pointermove', function(e){
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4){ moved = true; track.dataset.moved = '1'; }
      track.scrollLeft = startL - dx;
    });
    window.addEventListener('pointerup', function(){
      if (down){ down=false; track.classList.remove('dragging'); }
    });
    update();
  });

  /* ---------- before / after ---------- */
  var ba = document.getElementById('ba');
  if (ba){
    var pos = 50;
    function setPos(clientX){
      var r = ba.getBoundingClientRect();
      pos = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
      ba.style.setProperty('--pos', pos + '%');
    }
    var dragging = false;
    ba.addEventListener('pointerdown', function(e){ dragging = true; setPos(e.clientX); ba.setPointerCapture(e.pointerId); });
    ba.addEventListener('pointermove', function(e){ if (dragging) setPos(e.clientX); });
    ba.addEventListener('pointerup', function(){ dragging = false; });
    ba.style.setProperty('--pos', pos + '%');
  }

  /* ---------- inquiry form ---------- */
  var form = document.getElementById('inquiry');
  var ok = document.getElementById('formOk');
  if (form){
    form.addEventListener('submit', function(e){
      e.preventDefault();
      function done(){
        form.querySelectorAll('.field, .full:has(.btn)').forEach(function(el){ el.style.display='none'; });
        ok.hidden = false;
      }
      if (form.getAttribute('data-netlify') !== null){
        var params = new URLSearchParams(new FormData(form)).toString();
        fetch('/', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body: params })
          .then(done).catch(done);
      } else {
        done();
      }
    });
  }
})();

/* ============ FLIPBOOK ============ */
(function(){
  "use strict";
  if (typeof St === 'undefined') return;
  var books = document.querySelectorAll('.flipbook');
  if (!books.length) return;
  function pad(n){ return String(n).padStart(2,'0'); }
  books.forEach(function(el){
    if (el.dataset.init) return;
    var count = parseInt(el.dataset.pages || '0', 10);
    var src = el.dataset.src || '';
    if (!count || !src) return;
    el.dataset.init = '1';
    var urls = [];
    for (var i = 1; i <= count; i++){ urls.push(src + pad(i) + '.jpg'); }
    var flip = new St.PageFlip(el, {
      width: 400, height: 566,
      size: 'stretch',
      minWidth: 260, maxWidth: 720,
      minHeight: 368, maxHeight: 1019,
      maxShadowOpacity: 0.4,
      showCover: true,
      flippingTime: 650,
      autoSize: true,
      showPageCorners: true,
      disableFlipByClick: false,
      useMouseEvents: true,
      swipeDistance: 30
    });
    flip.loadFromImages(urls);
    el.__flip = flip;
    var wrap = el.closest('.flipwrap');
    if (wrap){
      var countEl = wrap.querySelector('[data-flip-count]');
      var prevEl = wrap.querySelector('[data-flip-prev]');
      var nextEl = wrap.querySelector('[data-flip-next]');
      var update = function(){
        if (countEl) countEl.textContent = pad(flip.getCurrentPageIndex() + 1) + ' / ' + pad(flip.getPageCount());
      };
      flip.on('flip', update);
      if (prevEl) prevEl.addEventListener('click', function(){ flip.flipPrev(); });
      if (nextEl) nextEl.addEventListener('click', function(){ flip.flipNext(); });
      update();
    }
  });
  document.addEventListener('keydown', function(e){
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
    var book = document.querySelector('.flipbook[data-init]');
    if (!book || !book.__flip) return;
    if (e.key === 'ArrowRight'){ book.__flip.flipNext(); } else { book.__flip.flipPrev(); }
  });
})();

/* ============ LIGHTBOX ============ */
(function(){
  "use strict";
  var lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML =
    '<button class="lb-close" aria-label="Close">\u00D7</button>' +
    '<button class="lb-prev" aria-label="Previous"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 3L5 8l5 5"/></svg></button>' +
    '<button class="lb-next" aria-label="Next"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3l5 5-5 5"/></svg></button>' +
    '<img src="" alt="">' +
    '<p class="lb-cap"></p>' +
    '<p class="lb-count"></p>';
  document.body.appendChild(lb);

  var img = lb.querySelector('img');
  var cap = lb.querySelector('.lb-cap');
  var cnt = lb.querySelector('.lb-count');

  function collect(){
    var list = [];
    document.querySelectorAll('.media img').forEach(function(im){
      if (im.closest('a') || im.closest('.flipbook')) return;
      list.push(im);
    });
    return list;
  }
  var items = collect();
  var index = 0;

  function open(i){
    if (!items.length) return;
    index = (i + items.length) % items.length;
    var im = items[index];
    img.src = im.currentSrc || im.src;
    img.alt = im.alt || '';
    var fig = im.closest('figure');
    var capEl = fig ? fig.querySelector('.cap') : null;
    cap.textContent = capEl ? capEl.textContent.trim() : '';
    cnt.textContent = String(index+1).padStart(2,'0') + ' / ' + String(items.length).padStart(2,'0');
    lb.classList.add('open');
    document.body.classList.add('locked');
  }
  function close(){
    lb.classList.remove('open');
    document.body.classList.remove('locked');
  }

  document.addEventListener('click', function(e){
    var im = e.target.closest('.media img');
    if (!im || im.closest('a') || im.closest('.flipbook')) return;
    var dragEl = im.closest('.drag');
    if (dragEl && dragEl.dataset.moved === '1'){ delete dragEl.dataset.moved; return; }
    var i = items.indexOf(im);
    if (i > -1) open(i);
  });

  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.addEventListener('click', function(e){ if (e.target === lb) close(); });
  lb.querySelector('.lb-prev').addEventListener('click', function(){ open(index - 1); });
  lb.querySelector('.lb-next').addEventListener('click', function(){ open(index + 1); });

  document.addEventListener('keydown', function(e){
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowLeft') open(index - 1);
    else if (e.key === 'ArrowRight') open(index + 1);
  });

  window.addEventListener('load', function(){ items = collect(); });
})();
// Open the parent <details> when linking to something inside it
function openToHash(){
  const id = location.hash.slice(1);
  if(!id) return;
  const el = document.getElementById(id);
  if(!el) return;
  el.closest('details')?.setAttribute('open','');
  requestAnimationFrame(()=> el.scrollIntoView({behavior:'smooth', block:'start'}));
}
addEventListener('hashchange', openToHash);
addEventListener('DOMContentLoaded', openToHash);
/* Nav dropdowns */
document.querySelectorAll('.nav-item.has-sub').forEach(item => {
  const btn = item.querySelector('.sub-toggle');
  const sub = item.querySelector('.sub');
  if(!btn || !sub) return;

  btn.addEventListener('click', e => {
    e.preventDefault();
    const open = sub.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', open);
  });

  item.addEventListener('keydown', e => {
    if(e.key === 'Escape'){
      sub.classList.remove('is-open');
      btn.setAttribute('aria-expanded','false');
      btn.focus();
    }
  });
});

document.addEventListener('click', e => {
  if(e.target.closest('.nav-item.has-sub')) return;
  document.querySelectorAll('.sub.is-open').forEach(s => {
    s.classList.remove('is-open');
    s.previousElementSibling?.setAttribute?.('aria-expanded','false');
  });
});