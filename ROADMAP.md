# Roadmap

Future work, none of this is implemented. See `CHANGELOG.md` for what's shipped and `README.md` for known v1 deviations.

## Improve architecture and simplify logic and names

- Calendar-aware date picker. `calendar.system` renders dates in julian/islamic/hebrew throughout the UI, but the native `<input type="date">` popup itself always stays Gregorian — a custom-built widget would be needed to pick dates in the selected system directly.
