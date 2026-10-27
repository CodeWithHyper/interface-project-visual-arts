// Exercise the real application scripts with an HTMLParser-backed DOM adapter.
// This verifies behavior and state transitions, not browser layout or rendering.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const parser = path.join(__dirname, 'check_structure.py');
const fixtures = JSON.parse(execFileSync('python3', [parser, '--fixtures'], {encoding: 'utf8'}));
const sources = ['site-config.js', 'data.js', 'script.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8'));
const store = new Map();
const drafts = new Map();

class Element {
  constructor(node, owner) {
    this.tagName = node.tag;
    this.attrs = {...node.attrs};
    this.owner = owner;
    this.listeners = {};
    this.children = [];
    this.value = this.attrs.value || '';
    this.hidden = 'hidden' in this.attrs;
    this.dataset = Object.fromEntries(Object.entries(this.attrs).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
    for (const child of node.children || []) {
      this.appendChild(typeof child === 'string' ? child : new Element(child, owner));
    }
    this.elements = {namedItem: name => this.querySelector(`[name="${name}"]`)};
  }
  appendChild(child) { this.children.push(child); if (typeof child !== 'string') child.parent = this; return child; }
  replaceChildren(...children) { this.children.forEach(child => { if (typeof child !== 'string') child.parent = null; }); this.children = []; children.forEach(child => this.appendChild(child)); }
  set innerHTML(text) {
    const parsed = JSON.parse(execFileSync('python3', [parser, '--parse-stdin'], {input: text, encoding: 'utf8'}));
    this.replaceChildren(...parsed.children.map(child => typeof child === 'string' ? child : new Element(child, this.owner)));
  }
  get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  set textContent(text) { this.replaceChildren(String(text)); }
  set className(value) { this.attrs.class = value; }
  get className() { return this.attrs.class || ''; }
  set href(value) { this.attrs.href = value; }
  get href() { return this.attrs.href; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  getAttribute(key) { return this.attrs[key]; }
  matches(selector) {
    const tag = selector.match(/^[a-z]+/);
    if (tag && tag[0] !== this.tagName) return false;
    const attributes = [...selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)];
    return attributes.every(([, key, value]) => key in this.attrs && (value === undefined || this.attrs[key] === value));
  }
  querySelectorAll(selector) {
    return this.children.filter(child => typeof child !== 'string').flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector) || null; }
  get isConnected() { return this.tagName === '#document' || Boolean(this.parent?.isConnected); }
  addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
  emit(name, properties = {}, bubble = false) {
    const event = {target: this, preventDefault() {}, ...properties};
    let node = this;
    do {
      for (const listener of node.listeners[name] || []) listener(event);
      node = bubble ? node.parent : null;
    } while (node);
  }
  click() { this.emit('click', {}, true); }
  focus() { this.owner.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.emit('close'); }
  setCustomValidity(message) { this.validationMessage = message; }
  reportValidity() {
    return this.querySelectorAll('input').concat(this.querySelectorAll('select'), this.querySelectorAll('textarea')).every(field => !field.validationMessage && (!('required' in field.attrs) || field.value.length > 0) && (field.attrs.type !== 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)));
  }
  reset() { this.querySelectorAll('input').concat(this.querySelectorAll('select'), this.querySelectorAll('textarea')).forEach(field => { field.value = ''; field.validationMessage = ''; }); }
}
function load(file, options = {}) {
  const doc = new Element(fixtures[file], null);
  function assignOwner(node) { node.owner = doc; node.children.filter(child => typeof child !== 'string').forEach(assignOwner); }
  assignOwner(doc);
  doc.body = doc.querySelector('body');
  doc.getElementById = id => doc.querySelector(`[id="${id}"]`);
  doc.createElement = tag => new Element({tag, attrs: {}, children: []}, doc);
  const storage = map => ({
    getItem(key) { if (options.blockStorage) throw Error('Storage blocked'); return map.get(key) || null; },
    setItem(key, value) { if (options.blockStorage) throw Error('Storage blocked'); map.set(key, value); },
    removeItem(key) { map.delete(key); }
  });
  const location = {search: options.search || '', pathname: '/' + file};
  const media = {addEventListener(name, callback) { this.change = callback; }};
  const context = vm.createContext({document: doc, window: {matchMedia: () => media}, localStorage: storage(store), sessionStorage: storage(drafts), location, URL, URLSearchParams, history: {replaceState() {}}});
  sources.forEach((source, index) => {
    if (index === 1 && options.email) vm.runInContext(`SITE_CONFIG.contactEmail = ${JSON.stringify(options.email)};`, context);
    vm.runInContext(source, context);
  });
  return {doc, location, media, context, id: id => doc.getElementById(id)};
}
const count = (host, tag) => host.querySelectorAll(tag).length;
let app = load('index.html');
assert.equal(count(app.id('featured-grid'), 'article'), 3);
assert.equal(count(app.id('trending-grid'), 'article'), 3);
app.id('menu-toggle').click();
assert.equal(app.id('mobile-nav').hidden, false);
app.doc.emit('keydown', {key: 'Escape'});
assert.equal(app.id('mobile-nav').hidden, true);
assert.equal(app.doc.activeElement, app.id('menu-toggle'));
app.id('menu-toggle').click();
app.media.change({matches: true});
assert.equal(app.id('mobile-nav').hidden, true);

app = load('explore.html');
assert.equal(count(app.id('art-grid'), 'article'), 10);
app.id('art-search').value = 'mira';
app.id('art-search').emit('input');
assert.equal(count(app.id('art-grid'), 'article'), 4);
app.id('filters').querySelector('[data-category="Digital Art"]').click();
assert.equal(count(app.id('art-grid'), 'article'), 2);
app.id('art-search').value = 'not a real work';
app.id('art-search').emit('input');
assert.equal(count(app.id('art-grid'), 'article'), 0);
assert.equal(app.id('gallery-empty').hidden, false);
app.id('reset-gallery').click();
assert.equal(count(app.id('art-grid'), 'article'), 10);
app.id('art-sort').value = 'title';
app.id('art-sort').emit('change');
const titles = app.id('art-grid').querySelectorAll('h3').map(node => node.textContent);
assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));
const first = app.id('art-grid').querySelector('[data-art-id="loading-identity"]');
first.click();
assert.equal(app.id('art-dialog').open, true);
assert.equal(app.id('modal-title').textContent, 'Loading Identity');
app.id('save-art').click();
assert.equal(app.id('save-art').getAttribute('aria-pressed'), 'true');
app.id('modal-close').click();
assert.equal(app.doc.activeElement, first);
app = load('explore.html');
app.id('filters').querySelector('[data-category="Saved"]').click();
assert.equal(count(app.id('art-grid'), 'article'), 1);
app.id('art-grid').querySelector('[data-art-id]').click();
app.id('save-art').click();
app.id('modal-close').click();
assert.equal(count(app.id('art-grid'), 'article'), 0);
assert.equal(app.doc.activeElement.getAttribute('data-category'), 'Saved');

app = load('memes.html');
assert.equal(count(app.id('meme-gallery'), 'article'), 5);
const reaction = () => app.doc.querySelector('[data-meme-id="buffering-brain"][data-reaction="haha"]');
const originalCount = Number(reaction().textContent.match(/\d+/)[0]);
reaction().click();
assert.equal(Number(reaction().textContent.match(/\d+/)[0]), originalCount + 1);
assert.equal(reaction().getAttribute('aria-pressed'), 'true');
app = load('memes.html');
assert.equal(reaction().getAttribute('aria-pressed'), 'true');
reaction().click();
assert.equal(reaction().getAttribute('aria-pressed'), 'false');
assert.equal(Number(reaction().textContent.match(/\d+/)[0]), originalCount);
app.doc.querySelector('[data-meme-id="buffering-brain"][data-reaction="love"]').click();
reaction().click();
assert.equal(app.doc.querySelector('[data-meme-id="buffering-brain"][data-reaction="love"]').getAttribute('aria-pressed'), 'false');
app.id('meme-sort').value = 'reactions';
app.id('meme-sort').emit('change');
assert.equal(count(app.id('meme-gallery'), 'article'), 5);

app = load('nft-gallery.html');
assert.equal(count(app.id('nft-grid'), 'article'), 5);
app.doc.querySelector('[data-collect-id="loading-identity"]').click();
assert.equal(app.doc.querySelector('[data-collection-count]').textContent, '1');
app = load('nft-gallery.html', {search: '?view=collection'});
assert.equal(count(app.id('nft-grid'), 'article'), 1);
app.doc.querySelector('[data-collect-id="loading-identity"]').click();
assert.equal(count(app.id('nft-grid'), 'article'), 0);
assert.equal(app.id('collection-empty').hidden, false);
assert.equal(app.doc.activeElement, app.id('browse-editions'));
app.id('browse-editions').click();
assert.equal(count(app.id('nft-grid'), 'article'), 5);

app = load('about.html');
assert.equal(count(app.id('team-grid'), 'article'), 3);
assert.equal(count(app.id('artist-profiles'), 'article'), 3);
app = load('contact.html');
const form = app.id('contact-form');
const fill = (name, value) => { form.elements.namedItem(name).value = value; };
fill('name', '  Test visitor  ');
fill('email', 'not-an-email');
fill('subject', 'Project feedback');
fill('message', 'A useful message about the project.');
form.emit('submit');
assert.equal(drafts.size, 0);
fill('email', 'visitor@example.com');
fill('message', '          x');
form.emit('submit');
assert.equal(drafts.size, 0);
fill('message', 'A useful message about the project.');
form.emit('submit');
assert.ok(app.id('contact-status').textContent.includes('Nothing has been sent'));
assert.equal(JSON.parse(drafts.get('pixelverse-contact-draft')).name, 'Test visitor');
app = load('contact.html');
assert.equal(app.id('contact-name').value, 'Test visitor');
app.id('clear-draft').click();
assert.equal(drafts.size, 0);
assert.equal(app.id('contact-name').value, '');
app = load('contact.html', {email: 'team@example.com'});
for (const [name, value] of Object.entries({name: 'Visitor', email: 'visitor@example.com', subject: 'Project feedback', message: 'Hello team, I like this project.'})) app.id('contact-form').elements.namedItem(name).value = value;
app.id('contact-form').emit('submit');
assert.ok(app.location.href.startsWith('mailto:team@example.com?subject='));
assert.ok(!app.id('contact-status').textContent.includes('Message sent'));
for (const file of Object.keys(fixtures)) {
  const blocked = load(file, {blockStorage: true});
  assert.equal(blocked.id('storage-notice').hidden, false);
}
console.log('PASS: home selections; mobile navigation; combined search/filter/sort; empty and saved states; dialog focus; reaction persistence/toggling; collection persistence/removal; contact validation, drafts and email handoff; storage fallback on all six pages');
