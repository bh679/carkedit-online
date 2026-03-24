# Visual Style Guide — Carked It! Online

## Colour Palette

### Brand Colours (from carkedit.com)
- **Primary Purple**: #9842FF — buttons, accents
- **Gold/Yellow**: #FFB700 — highlights, emphasis
- **Black**: #000000 — text, icons
- **White**: #FFFFFF — backgrounds, contrast

### Deck Colours (from physical cards)
- **Die deck**: Yellow/gold tones — death-themed cards
- **Live deck**: Green tones — life-themed cards
- **Bye deck**: Blue tones — afterlife-themed cards

### Card Background Tones
Cards use a range of background colours to match their theme:
- Light blue (#A8D8EA style) — common for Bye cards
- Yellow/gold (#F5C542 style) — common for Die cards
- Green tints — common for Live cards
- Occasional dark backgrounds (dark grey, navy) for dramatic cards
- Pink/magenta for humorous or provocative cards

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
