# QRGenerator — QR Code Generator

A fast, accessible, dependency-light QR code generator that runs entirely in the browser. Build QR codes from text, URLs, email, phone, SMS or Wi-Fi credentials, style them (colors, dot shapes, corners, margin), add a center logo, and export as PNG, JPEG or SVG. No backend, no database, no build step.

**Live features**
- Six content types: Text, URL, Email, Phone, SMS, Wi-Fi
- Debounced live preview while typing
- Full visual customization: size, margin, colors, error-correction level, dot style, corner-square style, corner-dot style
- Logo upload with adjustable size, centered automatically
- Download as PNG, JPEG or SVG with a custom filename
- Dark mode, toasts, tooltips, and a keyboard-friendly UI
- Client-side validation with friendly inline errors
- Semantic HTML, ARIA labeling, visible focus states, keyboard navigation

## Tech stack

- HTML5
- [W3.CSS](https://www.w3schools.com/w3css/) (loaded via CDN)
- Vanilla JavaScript (ES6+), no framework
- [qr-code-styling](https://github.com/kozakdenys/qr-code-styling) (loaded via CDN)

No package manager, bundler, or build step is required — every file is served as-is.

## Project structure

```
qr-code-generator/
│
├── index.html            Markup, SEO/meta tags, form structure
├── css/
│   └── style.css         Design tokens, layout, dark mode, components
├── js/
│   └── script.js         All application logic (modular, JSDoc-commented)
├── assets/
│   ├── icons/             Favicons and touch icon
│   └── images/            Open Graph cover image
├── robots.txt             Search engine crawl rules
├── sitemap.xml            Search engine sitemap
├── README.md
└── LICENSE
```

## Running locally

Because the app has no build step, any static file server works. From the project root:

```bash
# Python
python3 -m http.server 8000

# Node (if you have npx available)
npx serve .
```

Then open `http://localhost:8000` in your browser. Opening `index.html` directly via `file://` also works, since there is no server-side logic.

## Deploying

The project is a static site and can be deployed as-is to any static host:

- **Cloudflare Pages** — connect the repository and set the build output directory to the project root (no build command needed).
- **GitHub Pages** — push to a repository and enable Pages for the branch/root folder.
- **Netlify / Vercel / S3 / any static host** — upload the folder contents directly.

Before deploying, update the placeholder URLs in `index.html` (`canonical`, Open Graph, Twitter Card), `robots.txt`, and `sitemap.xml` to your real domain.

## How QR content is encoded

Each content type is translated into the standard string format that QR scanners expect:

| Type   | Format |
|--------|--------|
| Text   | Raw text, as typed |
| URL    | Normalized to include `https://` if missing |
| Email  | `mailto:` URI with optional subject/body query params |
| Phone  | `tel:` URI |
| SMS    | `sms:` URI with optional body |
| Wi-Fi  | `WIFI:T:<encryption>;S:<ssid>;P:<password>;H:<hidden>;;` |

## Accessibility

- Semantic landmarks (`header`, `main`, `nav`, `footer`) and a skip-to-content link
- All form controls have associated `<label>` elements
- Live regions (`aria-live`) for the QR preview and toast notifications
- Full keyboard operability, including tab-panel navigation and visible focus rings
- Color choices meet WCAG AA contrast in both light and dark themes

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Shift + D` | Toggle dark mode |
| `Ctrl/Cmd + Enter` | Download current QR as PNG |
| `Esc` | Clear the QR preview |

## Browser support

Latest versions of Chrome, Firefox, Edge, and Safari (desktop and mobile). The app uses standard ES6+ JavaScript and CSS custom properties; no polyfills are included.

## License

MIT — see [LICENSE](./LICENSE).
