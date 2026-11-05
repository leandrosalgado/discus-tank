# Discus aquarium

Browser-based Three.js viewer of the selected Option B aquarium layout.

[Open the viewer](https://leandrosalgado.github.io/discus-tank/)

The site includes visibility controls, camera presets and a dimensioned PDF.
The exported geometry is a viewing model, not an editable CAD or fabrication
specification. Fittings remain schematic.

## Development

Requires Node.js 20 or newer.

```sh
npm ci
npm run build
npm test
npm run dev
```

The development URL is `http://127.0.0.1:5180/discus-tank/`.
Browser checks use an installed Google Chrome: `npm run test:browser`.

GitHub Pages serves the committed `docs/` directory. All URLs are relative, so
the site works below the repository's project path.

Only the selected viewing geometry and the price-free drawings are included.
The native CAD, alternative layouts, room model, quotations and backups are
not part of this repository.

Three.js is distributed under its MIT licence, included in
`docs/THREE-LICENSE.txt`.
