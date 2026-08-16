# LSW Designs — Portfolio Website

Plain HTML / CSS / JS — no build tools, no dependencies.
Edit with a simple text editor, publish for free.

---

## What's where

| File | What it is |
|---|---|
| `index.html` | Home — hero, work highlights, services list, small about, contact form |
| `work.html` | Case studies (YOUR PROJECTS GO HERE) |
| `services.html` | The six services in detail |
| `process.html` | How you work + before/after slider |
| `about.html` | Your story, experience, skills |
| `assets/css/styles.css` | ALL styling — colours, fonts, layout |
| `assets/js/main.js` | Interactions (scroll reveals, drag gallery, form) |
| `assets/img/` | All images — put yours here |
| `assets/fonts/` | Self-hosted fonts |
| `single-file/` | One-file versions of every page |

---

## THE 3 EDITS YOU'LL DO MOST

### 1. Change text
Open the `.html` file in an editor, search (Ctrl/Cmd + F) for the sentence,
type over it. Done.

### 2. Replace an existing image (quickest swap)
1. Save your image into `assets/img/` **with the same file name** as the one
   you're replacing (e.g. `hero.jpg`, `w1-look.jpg`, `about.jpg`).
2. Refresh. Done — no HTML editing.

### 3. Change colours
`assets/css/styles.css` → top of file, under `:root` — edit the hex values.

---

## ADDING YOUR OWN WORK (step by step)

### Step 0 — prepare your images
1. **Convert PDFs to JPGs** (lookbooks, tech packs):
   - Free online: ilovepdf.com/pdf_to_jpg
   - Mac: open in Preview → File → Export → JPEG
   - Windows: Adobe Acrobat → Export → Image
2. **Rename** them simply: no spaces, lowercase — e.g. `ss26-01.jpg`, `aw26-03.jpg`
3. **Size:** ~1600–2000 px wide is perfect. JPG or PNG both work.
   (Under ~400 KB each — compress at squoosh.app or tinypng.com if needed.)
4. Put them all in the **`assets/img/`** folder.

### Step 1 — open `work.html`
Scroll down. You'll see three `<article class="cs">` blocks (the placeholder
projects Vitrine / Fluid / Rosé). Each one is a self-contained project.

### Step 2 — copy & paste this template
To ADD a project, copy this whole block and paste it **before the last
`</article>`** in the file:

```html
<article class="cs" id="myproject">
  <div class="cs-head grid stack">
    <div class="s8">
      <p class="cs-idx">Project 04</p>
      <h3 class="cs-title">Project Name</h3>
      <p class="cs-sub">What it is — Season</p>
    </div>
    <div class="cs-meta s4 o9">
      <div><div class="k">Client</div><div class="v">Smashed Lemon</div></div>
      <div><div class="k">Year</div><div class="v">2026</div></div>
      <div><div class="k">Scope</div><div class="v">Full collection · Lookbook</div></div>
      <div><div class="k">Output</div><div class="v">23-page campaign book</div></div>
    </div>
  </div>

  <figure class="fig media reveal" data-cursor="View">
    <img src="assets/img/ss26-01.jpg" alt="Describe the image" loading="lazy" decoding="async">
    <figcaption class="cap"><b>Spread 01</b> — your caption here</figcaption>
  </figure>

  <figure class="fig media reveal" data-cursor="View" style="margin-top:clamp(24px,4vh,40px)">
    <img src="assets/img/ss26-02.jpg" alt="Describe the image" loading="lazy" decoding="async">
    <figcaption class="cap"><b>Spread 02</b> — your caption here</figcaption>
  </figure>
</article>
```

### Step 3 — change 4 things in the pasted block
1. `id="myproject"` → a unique short name, e.g. `id="ss26"`
2. Title, subtitle, client, year, scope, output → your real details
3. `src="assets/img/ss26-01.jpg"` → your actual file names
4. `alt="..."` and the captions → describe each image

**To add more images:** copy the whole `<figure>…</figure>` line again and
change the file name. To REMOVE a placeholder project: delete its whole
`<article class="cs">…</article>` block.

### Step 4 — (optional) add it to the home page too
In `index.html`, find the "WORK HIGHLIGHTS" section and copy one of the
`<a class="teaser" …>` links, then point it at your new project:

```html
<a class="teaser s7 reveal" href="work.html#ss26" data-cursor="View">
  <span class="media" style="aspect-ratio:4/5">
    <img src="assets/img/ss26-01.jpg" alt="Project Name" loading="lazy" decoding="async">
  </span>
  <span class="cap"><b>Project Name</b> — what it is</span>
</a>
```

The `href="work.html#ss26"` must match the `id` you gave the project.

---

## RECOMMENDED TOOLS

- **VS Code** (free) — code.visualstudio.com — best editor for this.
- **Live Server** extension in VS Code: right-click `index.html` →
  "Open with Live Server" → the site updates instantly when you save.
- Any plain text editor (Notepad / TextEdit) also works.

---

## PUBLISH ONLINE (free)

1. **Netlify** — netlify.com/drop — drag this whole folder onto the page. Live in 30 seconds.
2. **Vercel** — vercel.com — same idea.
3. **GitHub Pages** — free, keeps a version history.

---

## NOTES

- The contact form shows an on-page "thank you" message. To email submissions
  to yourself, connect Formspree (formspree.io) — or ask me to wire it up.
- Plain HTML means you can never "break" the site permanently — worst case,
  re-download this zip.

---

## ADDING A FLIPBOOK (the flip-through lookbook)

The Work page now has an interactive flipbook for the Summer '26 campaign book.
To add one for another season:

1. Convert your PDF to JPG pages — one image per page, cover first.
   - If your PDF pages are landscape spreads, split each into two halves
     (left + right) so the book reads portrait like a real book.
   - Free converter: ilovepdf.com/pdf_to_jpg — or ask me to do it for you.
2. Name them `01.jpg`, `02.jpg`, `03.jpg` … in page order.
3. Put them in a folder, e.g. `assets/pages/aw26/`.
4. In `work.html`, inside a project, paste:

```html
<div class="flipwrap">
  <div class="flipinner">
    <p class="flip-label">The lookbook — flip through</p>
    <div class="flipframe">
      <div class="flipbook" data-pages="24" data-src="assets/pages/aw26/aw26-"></div>
    </div>
    <div class="flipbar">
      <button class="strip-btn flipbtn" data-flip-prev aria-label="Previous page"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M10 3L5 8l5 5"/></svg></button>
      <span class="flipcount" data-flip-count>01 / 24</span>
      <button class="strip-btn flipbtn" data-flip-next aria-label="Next page"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 3l5 5-5 5"/></svg></button>
    </div>
    <p class="flip-hint">Drag to flick · swipe on mobile · ← → keys</p>
  </div>
</div>
```

5. Change `data-pages="24"` to your real page count, and `data-src="assets/pages/aw26/aw26-"` to your folder + file prefix (the file name before the number).

**Note:** the flipbook works when you open the folder in a browser (double-click
`index.html`) or publish the site — the "single-file" previews can't load the
flipbook pages. Page images around 1100 px wide / ~130 KB each are ideal.

---

## PUBLISH WITH GITHUB + NETLIFY (recommended)

A GitHub repository stores your site's files and their full history.
Connect it to Netlify once and every future edit auto-deploys.

1. Make sure `index.html` is at the TOP level of the folder you upload
   (drag the *contents* of the `portfolio` folder, not the folder itself,
   unless the tool asks for the folder).
2. Create a GitHub account (github.com) if you don't have one.
3. Push this folder to a new repository (GitHub Desktop is the easiest way —
   File → Add local repository → choose the folder → Publish repository).
4. In Netlify: Add new site → Import an existing project → GitHub →
   pick the repo → Deploy. Netlify detects publish dir = "." (already set in
   `netlify.toml`).
5. Done — every "commit" you push now redeploys the live site automatically.

---

## THE WORK PAGE — YEARS / SEASONS / GROUPS

`work.html` is organised as an archive:

- **Year** (e.g. 2026) → big year number + a list of the seasons inside
- **Season** (e.g. SS26) → title + client/year meta
- **Group** within a season → `Lookbook`, `Designs`, `Print work`

### To add a new season
Copy one `<article class="season" …>…</article>` block, change its `id`
(e.g. `id="aw26"`), the eyebrow/title, and the groups inside.

### To fill a group
Each group has a `.group-head` (label + one-line description). Replace the
`.group-empty` placeholder block with one figure per image:

```html
<figure class="fig media reveal" data-cursor="View">
  <img src="assets/img/ss26-cad-01.jpg" alt="CAD flat" loading="lazy" decoding="async">
  <figcaption class="cap"><b>Fig. 01</b> — your caption</figcaption>
</figure>
```

Wrap several figures in `<div class="grid stack">` and give each a width
(`s4`/`s5`/`s7`/`s8`) and an offset (`o5`/`o6`/`o9`) for the staggered layout.
The same template is written as a comment inside `work.html` next to each group.

### To add a whole year
Copy the whole `<div class="year" …>…</div>` block, change the year number
and the seasons inside it. Add a teaser on `index.html` pointing to it.
