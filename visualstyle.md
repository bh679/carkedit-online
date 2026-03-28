# Visual Style Guide — Carked It! Online

## Colour Palette

### Brand Colours (from carkedit.com)
- **Primary Purple**: #9842FF — buttons, accents, primary actions
- **Gold/Yellow**: #FFB700 — highlights, emphasis, director chip
- **Alert Red**: #E91934 — errors, warnings, destructive actions
- **Black**: #000000 — text, icons
- **White**: #FFFFFF — backgrounds, contrast

### UI Theme Colours
- **Background**: #1C1C2E — dark navy with purple undertone
- **Surface**: #252540 — card/panel backgrounds
- **Secondary**: #2D2D50 — secondary surfaces
- **Text**: #F0F0F0 — primary text
- **Text Muted**: #9A9AB0 — secondary text with purple tint
- **Gradient**: #4B35B5 → #9842FF — screen backgrounds (lobby, phases)

### Deck Colours (matched to physical card backs)
- **Die deck**: #DAA520 (goldenrod) — warm, earthy death tone
- **Live deck**: #4D9E4D (medium green) — natural, life-affirming
- **Bye deck**: #6B88B0 (steel blue) — calm, ethereal afterlife

### Deck Light Variants (for card backgrounds)
- **Die light**: #F5DEB3 — warm wheat
- **Live light**: #A8D5A8 — soft green
- **Bye light**: #B0C4DE — light steel blue

### Card Background Tones
Cards use a range of background colours to match their theme:
- Light blue (#B0C4DE style) — common for Bye cards
- Yellow/gold (#F5DEB3 style) — common for Die cards
- Green tints (#A8D5A8 style) — common for Live cards
- Occasional dark backgrounds (dark grey, navy) for dramatic cards
- Pink/magenta for humorous or provocative cards

### Colour Demo
See `color-demo.html` for a visual reference of the full palette with swatches,
card back previews, UI component examples, and screen mockups.

## Color Rules

- **Single source of truth:** All game colors are defined exclusively in `css/colors.css` as CSS custom properties.
- **No hardcoded colors:** Never write hex, `rgb()`, `rgba()`, `hsl()`, or named colors directly in any CSS file other than `css/colors.css`.
- **Always use variables:** Reference colors via `var(--color-*)` throughout all CSS files.
- **Adding new colors:** Define the new token in `css/colors.css` first, then reference it where needed.

## Typography

- **Primary Font**: Montserrat (sans-serif) — UI text, descriptions
- **Card Titles**: Bold, uppercase, decorative/display weight — the physical cards
  use a chunky serif/display font for titles
- **Card Body Text**: Clean, readable sans-serif
- **Discussion Prompts**: Lighter weight, smaller size, preceded by a speech bubble icon

## Card Design

### Layout Structure
Each card follows a consistent layout:
1. **Illustration** (top ~60%) — colourful, illustrated art with halftone/dot texture overlays
2. **Colour bar** — a solid colour band separating image from text
3. **Title** (bold, uppercase, centred)
4. **Description** (1-3 lines, centred)
5. **Discussion prompt** (optional, at bottom with speech bubble icon)

### Card Textures
- Many cards use a **halftone dot pattern** overlay on illustrations
- Backgrounds often have subtle **crosshatch or geometric textures**
- Cards have **rounded corners** (4mm on physical cards)

### Card Back Design
- Deck-coloured background (yellow/green/blue)
- "LIVE", "DIE", or "BYE!" text in large display font
- Skeleton hand reaching motif on Bye deck back

## UI Elements

### Buttons
- Rounded pill shape (large border-radius)
- Bold colour fills matching brand palette
- Clean white text on coloured backgrounds

### Backgrounds
- Dark theme for game screens (dark navy/charcoal)
- Light/white for informational screens

### Layout
- Centred card displays
- Responsive grid for multiple cards
- Clean spacing, no clutter
- Cards as primary visual focus

## Illustration Style
- Colourful, cartoon/illustrated art
- Mix of humour and sincerity
- Australian cultural references
- Inclusive representation of diverse people
- Skull/skeleton motifs used playfully throughout
