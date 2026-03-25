# Image Optimization Log

## 2026-03-25 — Lossless JPG Optimization

**Tool:** `jpegtran -progressive -optimize -copy none`

| Metric | Value |
|--------|-------|
| Images | 183 |
| Before | 9.89 MB |
| After | 9.23 MB |
| Saved | 672 KB (6.6%) |
| Quality loss | None (lossless) |

All card illustrations in `assets/illustrations/{die,live,bye}/` were optimized.
Dimensions unchanged (503x700px). Visual output identical.

### What the flags do

- `-optimize` — Recomputes Huffman coding tables (default encoders use generic tables)
- `-progressive` — Progressive scan order (smaller files + progressive browser loading)
- `-copy none` — Strips unused metadata (no EXIF data was present)

### Re-running

```bash
find assets/illustrations -name "*.jpg" -exec \
  jpegtran -progressive -optimize -copy none -outfile {} {} \;
```

Requires `jpegtran` (part of libjpeg-turbo / jpeg-turbo).
