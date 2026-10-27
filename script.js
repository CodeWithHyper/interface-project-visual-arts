"use strict";

const {artworks, artists} = PIXORA_DATA;
const page = document.body.dataset.page;
const collectibleIds = new Set(artworks.filter(art => art.category !== "Memes").map(art => art.id));
// Keep existing browser storage keys so the rebrand preserves saved choices.
const storageKey = "pixelverse-state-v1";
const draftKey = "pixelverse-contact-draft";
const reactionTypes = [
  {id: "haha", icon: "😂", label: "Funny", factor: 1},
  {id: "love", icon: "💜", label: "Love", factor: .6},
  {id: "wow", icon: "✨", label: "Inspired", factor: .3}
];
const byId = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const knownId = id => artworks.some(art => art.id === id);

function storageNotice() {
  const notice = byId("storage-notice");
  notice.hidden = false;
  notice.textContent = "Browser storage is unavailable. Your choices will work until you leave this page.";
}

function readState() {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey)) || {};
    const safeIds = (items, valid) => Array.isArray(items) ? [...new Set(items.filter(valid))] : [];
    const reactions = {};
    for (const [id, reaction] of Object.entries(value.reactions || {})) {
      if (knownId(id) && reactionTypes.some(type => type.id === reaction)) reactions[id] = reaction;
    }
    return {
      saved: safeIds(value.saved, knownId),
      collection: safeIds(value.collection, id => collectibleIds.has(id)),
      reactions
    };
  } catch {
    storageNotice();
    return {saved: [], collection: [], reactions: {}};
  }
}
let state = readState();

function persistState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    storageNotice();
  }
}

function toggleId(list, id) {
  const index = list.indexOf(id);
  if (index === -1) list.push(id);
  else list.splice(index, 1);
}

function artworkImagePath(art) {
  if (typeof art.image !== "string" || !art.image.trim()) return "";
  try {
    const src = art.image.trim();
    const url = new URL(src, "https://pixora.local/");
    return ["http:", "https:"].includes(url.protocol) ? src : "";
  } catch { return ""; }
}

function artworkImageMarkup(art, lazy = true) {
  const src = artworkImagePath(art);
  return src ? `<img class="card-image" src="${escapeHtml(src)}" alt="" loading="${lazy ? "lazy" : "eager"}" decoding="async" data-art-image data-fallback-visual="${escapeHtml(art.visual)}" data-art-title="${escapeHtml(art.title)}">` : "";
}

function artworkVisual(art, classes) {
  const image = artworkImageMarkup(art);
  return `<div class="art-visual ${classes} ${image ? "has-card-image" : escapeHtml(art.visual)}" role="img" aria-label="${escapeHtml(art.imageAlt || "Artwork: " + art.title)}">${image}</div>`;
}

// Keep an illustration visible if a replacement image cannot be loaded.
document.addEventListener("error", event => {
  const image = event.target;
  if (!image.matches?.("[data-art-image]")) return;
  const frame = image.parentElement;
  frame.className = frame.className.replace("has-card-image", image.dataset.fallbackVisual);
  frame.setAttribute("aria-label", "Placeholder illustration for " + image.dataset.artTitle);
  image.remove();
}, true);

function artworkCard(art, options = {}) {
  if (options.collectible) {
    const reacted = state.reactions[art.id] === "love";
    const hearts = reactionCount(art, reactionTypes.find(type => type.id === "love"));
    const price = art.price == null || art.price === "" ? "Not priced" : art.price;
    const reactionLabel = `${reacted ? "Remove love reaction from" : "Love"} ${art.title}`;
    return `<article class="art-card nft-card">
      <button type="button" class="card-open" data-art-id="${escapeHtml(art.id)}" aria-label="View details for ${escapeHtml(art.title)}">
        ${artworkVisual(art, "card-visual")}
        <div class="nft-card-body">
          <p class="nft-card-collection">${escapeHtml(art.collection)}</p>
          <h3>${escapeHtml(art.title)}</h3>
          <p class="nft-card-author">By ${escapeHtml(art.creator)}</p>
        </div>
      </button>
      <div class="nft-card-footer">
        <span class="nft-card-price"><span class="sr-only">Price: </span>${escapeHtml(price)}</span>
        <button class="nft-card-reaction" type="button" data-nft-reaction-id="${escapeHtml(art.id)}" aria-pressed="${reacted}" aria-label="${escapeHtml(reactionLabel)}, ${hearts} ${hearts === 1 ? "heart" : "hearts"}" title="${escapeHtml(reactionLabel)}"><span aria-hidden="true">${reacted ? "♥" : "♡"}</span><span data-nft-heart-count>${hearts}</span></button>
      </div>
    </article>`;
  }
  const badge = options.trending ? `<span class="trend-badge">↗ Demo trend ${art.trend}</span>` : escapeHtml(art.category);
  return `<article class="art-card">
    <button type="button" class="card-open" data-art-id="${escapeHtml(art.id)}" aria-label="View details for ${escapeHtml(art.title)}">
      ${artworkVisual(art, "card-visual")}
      <div class="card-body"><div class="card-meta"><span>${badge}</span><span class="mono">${escapeHtml(art.edition)}</span></div>
        <h3>${escapeHtml(art.title)}</h3><p class="creator-name">By ${escapeHtml(art.creator)} · Sample creator</p>
        <p class="card-description">${escapeHtml(art.description)}</p><div class="card-bottom"><span>${escapeHtml(art.collection)}</span><span aria-hidden="true">↗</span></div>
      </div>
    </button>
  </article>`;
}

// Render the logo from HTML immediately; show text only if the image fails.
document.querySelectorAll("[data-brand]").forEach(brand => {
  const logo = brand.querySelector("img");
  const showTextFallback = () => { brand.textContent = "Pixora"; };
  if (!SITE_CONFIG.logoSrc) {
    showTextFallback();
    return;
  }
  logo.addEventListener("error", showTextFallback);
  if (logo.getAttribute("src") !== SITE_CONFIG.logoSrc) {
    logo.setAttribute("src", SITE_CONFIG.logoSrc);
  }
  // A cached failure can occur before this deferred script runs.
  if (logo.complete && logo.naturalWidth === 0) showTextFallback();
});

// Shared navigation, social profiles, and collection totals.
const toggle = byId("menu-toggle");
const menu = byId("mobile-nav");
function closeMenu() {
  menu.hidden = true;
  toggle.setAttribute("aria-expanded", "false");
  toggle.setAttribute("aria-label", "Open navigation menu");
}
toggle.addEventListener("click", () => {
  const opening = menu.hidden;
  menu.hidden = !opening;
  toggle.setAttribute("aria-expanded", String(opening));
  toggle.setAttribute("aria-label", opening ? "Close navigation menu" : "Open navigation menu");
});
menu.querySelectorAll("a").forEach(link => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !menu.hidden) {
    closeMenu();
    toggle.focus();
  }
});
window.matchMedia("(min-width: 1101px)").addEventListener("change", event => {
  if (event.matches) closeMenu();
});

function safeSocialUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch { return null; }
}
document.querySelectorAll("[data-social-links]").forEach(host => {
  host.innerHTML = SITE_CONFIG.socials.map(social => {
    const url = safeSocialUrl(social.url);
    return url
      ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(social.name)} ↗</a>`
      : `<span class="social-placeholder">${escapeHtml(social.name)} <small>Profile coming soon</small></span>`;
  }).join("");
});
function updateCollectionCounts() {
  document.querySelectorAll("[data-collection-count]").forEach(node => {
    node.textContent = state.collection.length;
  });
  if (byId("collection-noun")) byId("collection-noun").textContent = state.collection.length === 1 ? "work" : "works";
}
updateCollectionCounts();

// Home: curated and illustrative trending selections.
if (page === "home") {
  byId("featured-grid").innerHTML = artworks.filter(art => art.featured).slice(0, 3).map(art => artworkCard(art)).join("");
  byId("trending-grid").innerHTML = [...artworks].sort((a, b) => b.trend - a.trend).slice(0, 3).map(art => artworkCard(art, {trending: true})).join("");
}

// Explore: search, categories, saved works, sort, and empty states work together.
let activeFilter = "All Works";
function renderGallery() {
  const query = byId("art-search").value.trim().toLowerCase();
  const sort = byId("art-sort").value;
  const matches = artworks.filter(art => {
    const categoryMatch = activeFilter === "All Works" ||
      (activeFilter === "Featured" && art.featured) ||
      (activeFilter === "Saved" && state.saved.includes(art.id)) || art.category === activeFilter;
    const searchMatch = [art.title, art.creator, art.collection, art.category, art.description].join(" ").toLowerCase().includes(query);
    return categoryMatch && searchMatch;
  }).sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "trending" ? b.trend - a.trend : Number(b.featured) - Number(a.featured));
  byId("art-grid").innerHTML = matches.map(art => artworkCard(art)).join("");
  byId("gallery-count").textContent = `${matches.length} of ${artworks.length} prototype works · ${activeFilter}${query ? ` · Search: “${byId("art-search").value.trim()}”` : ""}`;
  byId("gallery-empty").hidden = matches.length > 0;
  byId("filters").querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.category === activeFilter)));
}
if (page === "explore") {
  const categories = ["All Works", "Digital Art", "Illustrations", "3D", "Animated", "Memes", "Featured", "Saved"];
  byId("filters").innerHTML = categories.map(category => `<button class="pill secondary" type="button" data-category="${category}" aria-pressed="false">${category}</button>`).join("");
  byId("filters").addEventListener("click", event => {
    const filter = event.target.closest("[data-category]");
    if (!filter) return;
    activeFilter = filter.dataset.category;
    renderGallery();
  });
  byId("search-form").addEventListener("submit", event => event.preventDefault());
  byId("art-search").addEventListener("input", renderGallery);
  byId("art-sort").addEventListener("change", renderGallery);
  byId("reset-gallery").addEventListener("click", () => {
    activeFilter = "All Works";
    byId("art-search").value = "";
    byId("art-sort").value = "featured";
    renderGallery();
    byId("art-search").focus();
  });
  renderGallery();
}

// Memes: one reaction per work, changeable or removable, saved locally.
const memes = artworks.filter(art => art.category === "Memes");
function reactionCount(art, type) {
  return Math.round(art.reactions * type.factor) + Number(state.reactions[art.id] === type.id);
}
function memeScore(art) {
  return reactionTypes.reduce((sum, type) => sum + reactionCount(art, type), 0);
}
function renderMemes(focusReaction) {
  const sort = byId("meme-sort").value;
  const sorted = [...memes].sort((a, b) => sort === "title" ? a.title.localeCompare(b.title) : sort === "reactions" ? memeScore(b) - memeScore(a) : b.trend - a.trend);
  byId("meme-gallery").innerHTML = sorted.map(art => `<article class="art-card">
    <button class="card-open" type="button" data-art-id="${art.id}" aria-label="View ${escapeHtml(art.title)} details">
      ${artworkImagePath(art) ? artworkVisual(art, "meme-visual") : `<div class="art-visual meme-visual ${art.visual}" role="img" aria-label="${escapeHtml(art.caption || art.title)}. ${escapeHtml(art.punchline || art.description)}"><span class="meme-caption">${escapeHtml(art.caption || art.title.toUpperCase())}</span><span class="meme-caption">${escapeHtml(art.punchline || (art.id === "404-self" ? "PLEASE TRY AGAIN AFTER COFFEE" : "ME AFTER ONE COMPLIMENT"))}</span></div>`}
      <div class="card-body"><div class="card-meta"><span>↗ Demo trend ${art.trend}</span><span>MEME / ${art.year}</span></div><h3>${escapeHtml(art.title)}</h3><p class="creator-name">By ${escapeHtml(art.creator)} · Sample creator</p></div>
    </button><div class="reaction-row" role="group" aria-label="React to ${escapeHtml(art.title)}">${reactionTypes.map(type => `<button type="button" class="pill secondary" data-reaction="${type.id}" data-meme-id="${art.id}" aria-label="${type.label} reaction for ${escapeHtml(art.title)}" aria-pressed="${state.reactions[art.id] === type.id}"><span aria-hidden="true">${type.icon}</span> ${reactionCount(art, type)}</button>`).join("")}</div>
  </article>`).join("");
  if (focusReaction) document.querySelector(`[data-meme-id="${focusReaction.id}"][data-reaction="${focusReaction.type}"]`)?.focus();
}
if (page === "memes") {
  byId("trending-meme-title").textContent = [...memes].sort((a, b) => b.trend - a.trend)[0].title;
  byId("meme-sort").addEventListener("change", () => renderMemes());
  byId("meme-gallery").addEventListener("click", event => {
    const button = event.target.closest("[data-reaction]");
    if (!button) return;
    const id = button.dataset.memeId;
    const type = button.dataset.reaction;
    if (state.reactions[id] === type) delete state.reactions[id];
    else state.reactions[id] = type;
    persistState();
    renderMemes({id, type});
    byId("reaction-status").textContent = state.reactions[id] ? "Reaction updated for " + artworks.find(art => art.id === id).title : "Reaction removed.";
  });
  renderMemes();
}

// NFT gallery reactions and the browser-local collection view.
let collectionOnly = new URLSearchParams(location.search).get("view") === "collection";
function renderNfts() {
  const matches = artworks.filter(art => collectibleIds.has(art.id) && (!collectionOnly || state.collection.includes(art.id)));
  byId("nft-grid").innerHTML = matches.map(art => artworkCard(art, {collectible: true})).join("");
  byId("all-editions").setAttribute("aria-pressed", String(!collectionOnly));
  byId("my-collection").setAttribute("aria-pressed", String(collectionOnly));
  byId("nft-count").textContent = `${matches.length} ${matches.length === 1 ? "edition" : "editions"} · ${collectionOnly ? "My simulated collection" : "All prototype editions"}`;
  byId("collection-empty").hidden = matches.length > 0;
  updateCollectionCounts();
}
if (page === "nft") {
  const selectView = only => {
    collectionOnly = only;
    renderNfts();
    try { history.replaceState(null, "", only ? "?view=collection" : location.pathname); } catch { /* file previews may restrict history updates */ }
  };
  byId("all-editions").addEventListener("click", () => selectView(false));
  byId("my-collection").addEventListener("click", () => selectView(true));
  byId("browse-editions").addEventListener("click", () => {
    selectView(false);
    byId("all-editions").focus();
  });
  byId("nft-grid").addEventListener("click", event => {
    const button = event.target.closest("[data-nft-reaction-id]");
    if (!button) return;
    const id = button.dataset.nftReactionId;
    const reacted = state.reactions[id] !== "love";
    if (reacted) state.reactions[id] = "love";
    else delete state.reactions[id];
    persistState();
    const art = artworks.find(art => art.id === id);
    const title = art.title;
    const hearts = reactionCount(art, reactionTypes.find(type => type.id === "love"));
    const label = `${reacted ? "Remove love reaction from" : "Love"} ${title}`;
    button.setAttribute("aria-pressed", String(reacted));
    button.setAttribute("aria-label", `${label}, ${hearts} ${hearts === 1 ? "heart" : "hearts"}`);
    button.setAttribute("title", label);
    button.querySelector("span").textContent = reacted ? "♥" : "♡";
    button.querySelector("[data-nft-heart-count]").textContent = hearts;
    byId("collection-status").textContent = reacted ? `Love reaction added to ${title}.` : `Reaction removed from ${title}.`;
  });
  renderNfts();
}

// Shared artwork details and locally saved favorites.
const dialog = byId("art-dialog");
let activeArt = null;
let lastTrigger = null;
let modalArtworks = [];
function updateSave() {
  const saved = state.saved.includes(activeArt.id);
  byId("save-art").setAttribute("aria-pressed", String(saved));
  byId("save-art").textContent = saved ? "Saved ✓ · Unsave" : "Save artwork";
}
function renderModalArt(art) {
  activeArt = art;
  byId("modal-preview").className = "art-visual modal-preview " + (artworkImagePath(art) ? "has-card-image" : art.visual);
  byId("modal-preview").innerHTML = artworkImageMarkup(art, false);
  byId("modal-preview").setAttribute("aria-label", art.imageAlt || "Artwork preview for " + art.title);
  const details = {title: art.title, creator: "By " + art.creator + " · Fictional creator", description: art.description, category: art.category, collection: art.collection, year: art.year, edition: art.edition};
  for (const [key, value] of Object.entries(details)) byId("modal-" + key).textContent = value;
  byId("modal-feedback").textContent = "";
  byId("view-collection").href = collectibleIds.has(art.id) ? "nft-gallery.html" : "memes.html";
  byId("view-collection").textContent = collectibleIds.has(art.id) ? "NFT gallery ↗" : "More memes ↗";
  updateSave();
  byId("modal-thumbnails").querySelectorAll("button").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.modalArtId === art.id));
  });
  byId("modal-position").textContent = `Artwork ${modalArtworks.findIndex(item => item.id === art.id) + 1} of ${modalArtworks.length}: ${art.title}`;
}

function openArt(id, trigger) {
  const art = artworks.find(item => item.id === id);
  if (!art || !dialog) return;
  lastTrigger = trigger;
  const host = byId(page === "nft" ? "nft-grid" : page === "explore" ? "art-grid" : page === "memes" ? "meme-gallery" : "");
  const ids = host ? [...host.querySelectorAll("[data-art-id]")].map(card => card.dataset.artId) : artworks.map(item => item.id);
  modalArtworks = [...new Set(ids)].map(itemId => artworks.find(item => item.id === itemId)).filter(Boolean);
  if (!modalArtworks.some(item => item.id === id)) modalArtworks = [art];
  byId("modal-thumbnails").innerHTML = modalArtworks.map(item => `<button type="button" class="modal-thumbnail" data-modal-art-id="${escapeHtml(item.id)}" aria-label="Preview ${escapeHtml(item.title)}" aria-pressed="false">${artworkVisual(item, "modal-thumbnail-visual")}</button>`).join("");
  byId("modal-prev").disabled = modalArtworks.length < 2;
  byId("modal-next").disabled = modalArtworks.length < 2;
  renderModalArt(art);
  dialog.scrollTop = 0;
  dialog.showModal();
  byId("modal-close").focus();
}

function stepModal(direction) {
  if (modalArtworks.length < 2) return;
  const index = modalArtworks.findIndex(art => art.id === activeArt.id);
  renderModalArt(modalArtworks[(index + direction + modalArtworks.length) % modalArtworks.length]);
  byId("modal-thumbnails").querySelector('[aria-pressed="true"]')?.scrollIntoView?.({block: "nearest", inline: "nearest"});
}

if (dialog) {
  document.addEventListener("click", event => {
    const card = event.target.closest("[data-art-id]");
    if (card) openArt(card.dataset.artId, card);
  });
  byId("modal-close").addEventListener("click", () => dialog.close());
  byId("modal-prev").addEventListener("click", () => stepModal(-1));
  byId("modal-next").addEventListener("click", () => stepModal(1));
  byId("modal-thumbnails").addEventListener("click", event => {
    const thumbnail = event.target.closest("[data-modal-art-id]");
    if (thumbnail) renderModalArt(modalArtworks.find(art => art.id === thumbnail.dataset.modalArtId));
  });
  byId("modal-thumbnails").addEventListener("keydown", event => {
    const thumbnail = event.target.closest("[data-modal-art-id]");
    if (!thumbnail || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (event.key === "Home" || event.key === "End") renderModalArt(modalArtworks[event.key === "Home" ? 0 : modalArtworks.length - 1]);
    else stepModal(event.key === "ArrowRight" ? 1 : -1);
    byId("modal-thumbnails").querySelector('[aria-pressed="true"]').focus();
  });
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener("close", () => { if (lastTrigger?.isConnected) lastTrigger.focus(); });
  byId("save-art").addEventListener("click", () => {
    if (!activeArt) return;
    toggleId(state.saved, activeArt.id);
    persistState();
    updateSave();
    byId("modal-feedback").textContent = state.saved.includes(activeArt.id) ? "Saved. Find this work in Explore → Saved." : "Removed from your saved works.";
  });
  // Refresh saved-filter results after the dialog closes without leaving stale cards.
  if (page === "explore") dialog.addEventListener("close", () => {
    if (activeFilter === "Saved") {
      const id = lastTrigger?.dataset.artId || activeArt?.id;
      renderGallery();
      (document.querySelector(`[data-art-id="${id}"]`) || byId("filters").querySelector('[data-category="Saved"]')).focus();
    }
  });
}

// About: actual group members are configured separately from fictional artists.
if (page === "about") {
  byId("team-grid").innerHTML = SITE_CONFIG.team.map((member, index) => `<article class="profile-card"><div class="profile-avatar" aria-hidden="true">${escapeHtml(member.initials)}</div><p class="eyebrow">Project team / 0${index + 1}</p><h3>${escapeHtml(member.name)}</h3><p class="creator-name">${escapeHtml(member.role)}</p></article>`).join("");
  if (SITE_CONFIG.team.every(member => member.name !== "Member name to be added")) byId("team-note").textContent = "Meet the group bringing Pixora to life.";
  byId("artist-profiles").innerHTML = artists.map(artist => `<article class="profile-card ${escapeHtml(artist.theme)}"><div class="profile-avatar" aria-hidden="true">${escapeHtml(artist.symbol)}</div><p class="eyebrow">Fictional demo creator</p><h3>${escapeHtml(artist.name)}</h3><p class="creator-name">${escapeHtml(artist.role)}</p><p class="muted">${escapeHtml(artist.description)}</p></article>`).join("");
}

// Contact: save a local draft, or hand off to an email app when an address is configured.
if (page === "contact") {
  const form = byId("contact-form");
  byId("contact-submit").disabled = false;
  const fields = ["name", "email", "subject", "message"];
  const contactEmail = SITE_CONFIG.contactEmail.trim();
  const hasEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail);
  if (SITE_CONFIG.socials.some(social => safeSocialUrl(social.url))) {
    byId("social-note").textContent = "Follow the team for creative updates and project news.";
  }
  if (hasEmail) {
    byId("contact-note").textContent = "Complete the form to prepare a message in your email app. You’ll review and send it there.";
    byId("contact-submit").textContent = "Open email app ↗";
    const link = document.createElement("a");
    link.href = "mailto:" + contactEmail;
    link.textContent = contactEmail;
    byId("team-email").replaceChildren(link);
  }
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey));
    if (draft && typeof draft === "object") {
      fields.forEach(name => { if (typeof draft[name] === "string") form.elements.namedItem(name).value = draft[name]; });
      byId("contact-status").textContent = "Your draft has been restored in this tab. Nothing has been sent.";
    }
  } catch { /* Drafts are optional when session storage is unavailable. */ }
  byId("contact-message").addEventListener("input", event => event.target.setCustomValidity(""));
  form.addEventListener("submit", event => {
    event.preventDefault();
    fields.forEach(name => { form.elements.namedItem(name).value = form.elements.namedItem(name).value.trim(); });
    const message = form.elements.namedItem("message");
    message.setCustomValidity(message.value.length < 10 ? "Please write at least 10 characters." : "");
    if (!form.reportValidity()) return;
    const draft = Object.fromEntries(fields.map(name => [name, form.elements.namedItem(name).value]));
    let stored = true;
    try { sessionStorage.setItem(draftKey, JSON.stringify(draft)); } catch { stored = false; }
    if (hasEmail) {
      const body = `From: ${draft.name}\nReply email: ${draft.email}\n\n${draft.message}`;
      location.href = `mailto:${contactEmail}?subject=${encodeURIComponent("Pixora: " + draft.subject)}&body=${encodeURIComponent(body)}`;
      byId("contact-status").textContent = "Email draft prepared. Review and send it in your email app; this website has not sent a message.";
    } else {
      byId("contact-status").textContent = stored
        ? "Draft saved in this tab. Nothing has been sent. A team contact address is still being added."
        : "Your message is still in this form, but this browser could not save a draft. Nothing has been sent.";
    }
  });
  byId("clear-draft").addEventListener("click", () => {
    form.reset();
    try { sessionStorage.removeItem(draftKey); } catch { /* No stored draft to clear. */ }
    byId("contact-status").textContent = "Draft cleared.";
    byId("contact-name").focus();
  });
}
