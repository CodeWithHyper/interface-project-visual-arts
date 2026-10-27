# Pixora image assets

Keep the website's images in these folders:

```text
assets/images/
├── brand/
│   └── logo.png   ← save your supplied logo here
├── nfts/                ← NFT designs
├── memes/               ← meme images
└── artworks/            ← other gallery artwork
```

The folders are ready for your files. No sample images are included.

## Logo

Save the logo as `brand/logo.png`. The header and footer are already configured to use this exact path. They show the Pixora text until the image loads. If you use a different filename or format, update `logoSrc` in the project's `site-config.js`.

## Other images

Use descriptive filenames, for example `nfts/neon-avatar.webp` or `memes/exam-week.png`. Open the project's `data.js`, find the matching artwork by its `id` or title, and set its `image` field:

```js
"image": "assets/images/nfts/neon-avatar.webp"
```

Keep the entry's other fields. The image automatically replaces the CSS illustration in its cards and popup. Card images fill the existing frame; popups show the full image. Leave `image` empty to use the CSS illustration. If an image fails to load, the CSS illustration is restored.

For memes, use a path such as `assets/images/memes/exam-week.png`. Custom meme images do not receive extra caption overlays. You can add an `imageAlt` field with a short visual description for accessibility.

PNG, JPEG, WebP, GIF, AVIF, and SVG can be stored here.
