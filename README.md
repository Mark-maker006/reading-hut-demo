# Figma Home Preview

Static HTML/CSS previews for the active reading-game flow.

Source Figma file:
https://www.figma.com/design/mL71d1LBLALLgYOvp5f9yA/%E6%82%A6%E8%AF%BB%E5%B0%8F%E8%BE%BE%E4%BA%BA-to-%E5%8D%95%E8%AF%8D%E7%8E%8B--%E5%A4%9A%E5%AD%A9%E5%AD%90%E7%AE%A1%E7%90%86?node-id=149-1410&m=dev

The primary preview viewport is `393 x 852`. Complex artwork is stored locally under `assets/`; the pages do not depend on temporary Figma asset URLs.

## Active flow

```text
index.html
  -> level-map.html
      -> reading-hut.html
          -> illustration-book.html
          -> placement-video.html
      -> achievement.html
```

## Preview

From this folder:

```powershell
python -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```

## Project structure

- `index.html` / `styles.css` - plan home page.
- `level-map.html` / `level-map.css` - scrollable level map.
- `reading-hut.html` / `reading-hut.css` - reading room, reusable item cards, panels, and exchange interactions.
- `illustration-book.html` / `illustration-book.css` / `illustration-book.js` - furniture and decoration catalog.
- `placement-video.html` / `placement-video.css` / `placement-video.js` - placement-animation preview.
- `achievement.html` / `achievement.css` - achievement preview.
- `reading-hut-exchange.js` - testable exchange and item-order helpers.
- `assets/` - local runtime artwork only.
- `tests/` - layout, asset, interaction, and project-structure regression tests.
- `docs/` - design specifications, implementation plans, and handoff notes.
