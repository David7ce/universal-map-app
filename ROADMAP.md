# Roadmap

Future work, none of this is implemented. See `CHANGELOG.md` for what's shipped and `README.md` for known v1 deviations.

## Dynamic isochrones

Computing an isochrone live (e.g. on click) needs an external routing service, which conflicts with the "no backend, no paid services" non-goal (design spec, Section 11) unless explicitly accepted as an exception. The static pattern (precomputed isochrone polygons shipped as a normal `kind: "polygon"` layer, no engine code needed) is already documented in `README.md` ("Isochrone (travel-time) layers") and doesn't need this.
