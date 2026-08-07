# js/vendor

Third-party code, copied in verbatim. **Do not hand-edit anything in this directory** — to
change a library, re-pull it from the source below and re-record the details here.

The client has no build step and is deployed straight from git, so runtime dependencies have to
live in the repo rather than in `node_modules` or on a CDN.

## qrcode-generator.js

| | |
|---|---|
| Package | [`qrcode-generator`](https://www.npmjs.com/package/qrcode-generator) |
| Version | 2.0.4 |
| Author | Kazuhiko Arase |
| Licence | MIT (header retained at the top of the file) |
| Source file | `dist/qrcode.mjs` from the npm tarball, unmodified |
| SHA-256 | `ea91d7118a5395289170da848b7c6758b996163bfbccf312591ab65a4911b7c0` |

Renamed from `qrcode.mjs` to `.js` only so it is served with the right MIME type — the contents
are byte-identical to the published file.

Used by [`js/utils/qr.js`](../utils/qr.js), which wraps it for the lobby's share panel.

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

### Re-pulling

```bash
npm pack qrcode-generator@<version>
tar -xzf qrcode-generator-<version>.tgz
cp package/dist/qrcode.mjs js/vendor/qrcode-generator.js
```
