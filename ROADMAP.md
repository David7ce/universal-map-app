# Roadmap

Future work, none of this is implemented. See `CHANGELOG.md` for what's shipped and `README.md` for known v1 deviations.

Open items below; everything else previously listed here has shipped (see `CHANGELOG.md`).

- [Feature Request World Definition](feature-request-world-def.md)

- Border regions for paranormal-espana: undecided yet — Tenerife-only for now (expanding to all of Spain later), and whether to author boundary geojson by hand or pull region shapes from OpenStreetMap directly. Doesn't need `systems.time` (this world already has it disabled) — a `regionRole: "boundary"` layer works independently of temporal/calendar support.

## For future massive refactor to own Map Server and PostgreSQL
