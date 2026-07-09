# Live2D models

This directory is where Luna looks for the avatar model. **No model ships with the repo** — you bring
your own.

## Drop-in contract

Place a Live2D model in its own subfolder here:

```
public/models/<name>/<name>.model3.json   ← the manifest the loader points at
                     <name>.moc3           ← the model
                     textures/…            ← texture atlas
                     <name>.physics3.json  ← (optional) physics
                     …
```

The web front end serves everything under `public/models/` at `/models/…`, so a model at
`public/models/hana/hana.model3.json` is reachable as `/models/hana/hana.model3.json`.

## Notes

- This `README.md` is a tracked keeper so the (otherwise empty) `models/` directory survives a fresh
  clone — the build copies `public/models/` into `dist/models/`, and git does not preserve empty dirs.
- Where to find free/redistributable models, how to wire one up, and the per-model expression-preset
  caveat are covered in the setup guide.
