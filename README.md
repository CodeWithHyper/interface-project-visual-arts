# Pixora

A six-page visual arts prototype built with separate HTML, CSS, and JavaScript files. No framework, build step, or Tailwind CDN is required. Google Fonts is optional; local font fallbacks work offline.

## Run locally

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Serving all pages from one origin lets saved works, reactions, and the collection carry across pages reliably.

## Pages

| File | Features |
| --- | --- |
| `index.html` | Introduction, featured works, illustrative trending creations |
| `explore.html` | Search by title, creator, collection, category, or description; combined category filters; sorting; saved favorites; empty states |
| `memes.html` | Meme gallery, sample trending scores, sorting, toggleable reactions |
| `nft-gallery.html` | Compact artwork cards with collection, title, creator, price, toggleable love reactions, and existing collection view |
| `about.html` | Mission, vision, project team, clearly separated fictional creator profiles |
| `contact.html` | Validated contact form, tab-local drafts, email-app handoff when configured, social profiles |

## Customize

- `styles.css`: shared layout, responsive styles, original CSS artwork, and glossy buttons without pale edge highlights.
- `script.js`: shared navigation and page-specific interactions.
- `data.js`: sample artworks and fictional creators. Trend scores and starting reaction totals are illustrative.
- `site-config.js`: replace placeholder group members, add the team's email, and set social profile URLs. Social links must use HTTPS; unconfigured profiles display “Profile coming soon.”

Store image files in `assets/images/`, organized into `brand/`, `nfts/`, `memes/`, and `artworks/`. See `assets/images/README.md` for the folder guide.

Save the supplied Pixora logo as `assets/images/brand/logo.png`. That path is already configured in `site-config.js`; both the header and footer display the image automatically once it is available. Until then, they display the Pixora name.

To replace a card image, save the image in the appropriate folder and set that artwork's `image` field in `data.js`, for example `"image": "assets/images/nfts/my-design.png"`. It appears in the card and popup; leave the field empty to keep the CSS illustration. The theme colors and gradients are defined in `:root` in `styles.css`.

## Storage and contact behavior

Favorites, reactions, and the simulated NFT collection use `localStorage` on this browser and origin. If storage is blocked, interactions fall back to memory for the current page. The NFT gallery performs no transactions, minting, or ownership transfers.

Contact drafts use `sessionStorage` and last for the current tab session. With no configured email, submission saves a draft and explicitly confirms that nothing was sent. When `contactEmail` is configured, the form opens an email draft for the visitor to review and send in their email app. There is no server-side email delivery or inbox.

## Checks

```sh
node --check script.js
node --check data.js
node --check site-config.js
python3 tests/check_structure.py
node tests/check_interactions.cjs
```

The structural check uses Python's standard library. Interaction checks run the actual scripts with a lightweight DOM adapter; they do not replace visual browser QA.
