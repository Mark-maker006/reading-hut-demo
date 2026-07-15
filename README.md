# Figma Home Preview

Static HTML/CSS rebuild for Figma Frame 40.

Source Figma file:
https://www.figma.com/design/mL71d1LBLALLgYOvp5f9yA/%E6%82%A6%E8%AF%BB%E5%B0%8F%E8%BE%BE%E4%BA%BA-to-%E5%8D%95%E8%AF%8D%E7%8E%8B--%E5%A4%9A%E5%AD%A9%E5%AD%90%E7%AE%A1%E7%90%86?node-id=149-1410&m=dev

Implemented scope:
- `index.html` maps to Frame 40.
- The design source frame is `750 x 1624`; the preview frame is implemented at iPhone 16 size `393 x 852`.
- Complex visual assets use exported PNG files from `assets/frame40/` instead of CSS drawings.
- Figma MCP asset exports were generated for:
  - `149:1410` full Frame 40 screenshot/export
  - `150:2102` hero/background subtree
  - `147:1525` main content subtree
  - `150:2055` bottom tab subtree
  - `147:1455` weekly card subtree

## Preview

From this folder:

```powershell
python -m http.server 4173
```

Then open:

```text
http://localhost:4173/
```

## Files

- `index.html` - static Frame 40 page structure.
- `styles.css` - iPhone 16 static layout and visual styling.
- `assets/frame40/` - exported Figma assets used by the page.
