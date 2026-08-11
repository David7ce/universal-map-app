# Tree

Excludes `dist`, `builds`, `docs`, `node_modules`, `.git`, `.claude`, `.superpowers`, `.playwright-mcp`. `worlds/moon-map-photos/assets/photos/` (96 real `.jpg` files + 96 thumbnails) is collapsed to a count below — listing every filename isn't useful here.

## PowerShell command

```powershell
function Show-Tree {
    param($Path = '.', $Prefix = '', $Exclude = @('dist','builds','docs','node_modules','.git','.claude','.superpowers','.playwright-mcp'))
    $items = Get-ChildItem -LiteralPath $Path -Force | Where-Object { $Exclude -notcontains $_.Name } | Sort-Object @{Expression='PSIsContainer';Descending=$true}, Name
    $count = $items.Count
    for ($i = 0; $i -lt $count; $i++) {
        $item = $items[$i]
        $isLast = ($i -eq $count - 1)
        $connector = if ($isLast) { '`-- ' } else { '|-- ' }
        Write-Output "$Prefix$connector$($item.Name)"
        if ($item.PSIsContainer) {
            $newPrefix = $Prefix + $(if ($isLast) { '    ' } else { '|   ' })
            Show-Tree -Path $item.FullName -Prefix $newPrefix -Exclude $Exclude
        }
    }
}
Show-Tree -Path .
```

## Bash command

```bash
show_tree() {
  local path="${1:-.}" prefix="${2:-}"
  local exclude=(dist builds docs node_modules .git .claude .superpowers .playwright-mcp)
  local dirs=() files=() name base skip e
  for name in "$path"/* "$path"/.[!.]*; do
    [ -e "$name" ] || continue
    base="$(basename "$name")"
    skip=false
    for e in "${exclude[@]}"; do [ "$base" = "$e" ] && skip=true; done
    $skip && continue
    if [ -d "$name" ]; then dirs+=("$base"); else files+=("$base"); fi
  done
  IFS=$'\n' dirs=($(sort <<<"${dirs[*]:-}")); unset IFS
  IFS=$'\n' files=($(sort <<<"${files[*]:-}")); unset IFS
  local items=("${dirs[@]}" "${files[@]}")
  local count=${#items[@]} i=0
  for name in "${items[@]}"; do
    i=$((i+1))
    if [ $i -eq $count ]; then connector="\`-- "; newprefix="$prefix    "; else connector="|-- "; newprefix="$prefix|   "; fi
    echo "${prefix}${connector}${name}"
    [ -d "$path/$name" ] && show_tree "$path/$name" "$newprefix"
  done
}
show_tree .
```

## Result

```
|-- .github
|   `-- workflows
|       |-- ci.yml
|       `-- deploy-pages.yml
|-- plugins
|   `-- participate
|       |-- index.test.ts
|       |-- index.ts
|       |-- links.test.ts
|       `-- links.ts
|-- scripts
|   `-- fetch-osm-boundary.mjs
|-- src
|   |-- engine
|   |   |-- data
|   |   |   |-- loaders
|   |   |   |   |-- geojson-loader.ts
|   |   |   |   `-- geojson-sharded-loader.ts
|   |   |   |-- loader-registry.test.ts
|   |   |   |-- loader-registry.ts
|   |   |   `-- source-types.ts
|   |   |-- manifests
|   |   |   |-- app-manifest.ts
|   |   |   |-- layer-manifest.ts
|   |   |   |-- manifests.test.ts
|   |   |   |-- resolve-world-id.test.ts
|   |   |   `-- resolve-world-id.ts
|   |   |-- plugins
|   |   |   |-- activate.test.ts
|   |   |   |-- activate.ts
|   |   |   |-- registry.test.ts
|   |   |   `-- registry.ts
|   |   |-- region
|   |   |   |-- spatial-join.test.ts
|   |   |   `-- spatial-join.ts
|   |   |-- space
|   |   |   |-- leaflet
|   |   |   |   |-- coordinate-grid-layer.ts
|   |   |   |   |-- data-layer-renderer.ts
|   |   |   |   |-- leaflet-map-adapter.ts
|   |   |   |   `-- map.ts
|   |   |   |-- coordinate-grid.test.ts
|   |   |   |-- coordinate-grid.ts
|   |   |   |-- map-adapter.ts
|   |   |   |-- map-crs.test.ts
|   |   |   |-- map-crs.ts
|   |   |   |-- style.test.ts
|   |   |   `-- style.ts
|   |   |-- state
|   |   |   |-- store.test.ts
|   |   |   `-- store.ts
|   |   |-- taxonomy
|   |   |   |-- compute-dimensions.ts
|   |   |   |-- taxonomy.test.ts
|   |   |   `-- tri-state.ts
|   |   `-- time
|   |       |-- calendar-conversion.test.ts
|   |       |-- calendar-conversion.ts
|   |       |-- calendar-grid.test.ts
|   |       |-- calendar-grid.ts
|   |       |-- calendar-systems.ts
|   |       |-- day-agenda.test.ts
|   |       |-- day-agenda.ts
|   |       |-- is-active-on.test.ts
|   |       |-- is-active-on.ts
|   |       |-- julian-calendar.test.ts
|   |       |-- julian-calendar.ts
|   |       |-- rrule-subset.test.ts
|   |       |-- rrule-subset.ts
|   |       `-- temporal-types.ts
|   |-- types
|   |   `-- leaflet-markercluster.d.ts
|   |-- ui
|   |   |-- panels
|   |   |   |-- CalendarBar.test.ts
|   |   |   |-- CalendarBar.ts
|   |   |   |-- CalendarGrid.ts
|   |   |   |-- CalendarView.ts
|   |   |   |-- info-field-format.test.ts
|   |   |   |-- info-field-format.ts
|   |   |   |-- LayerControl.ts
|   |   |   |-- Lightbox.ts
|   |   |   |-- PanelRight.ts
|   |   |   |-- search.test.ts
|   |   |   |-- search.ts
|   |   |   |-- SearchOverlay.ts
|   |   |   |-- SettingsControl.ts
|   |   |   |-- temporal-status.test.ts
|   |   |   |-- temporal-status.ts
|   |   |   `-- WelcomeView.ts
|   |   |-- app-chrome.ts
|   |   |-- branding.ts
|   |   |-- escape-html.test.ts
|   |   |-- escape-html.ts
|   |   |-- icons.ts
|   |   |-- strings.test.ts
|   |   `-- strings.ts
|   |-- main.ts
|   `-- styles.css
|-- worlds
|   |-- demo
|   |   |-- data
|   |   |   |-- poi.geojson
|   |   |   `-- regions.geojson
|   |   |-- layers
|   |   |   |-- heatmap.layer.json
|   |   |   |-- poi.layer.json
|   |   |   `-- regions.layer.json
|   |   |-- strings.json
|   |   `-- world.json
|   |-- events-canary-islands
|   |   |-- data
|   |   |   `-- events.geojson
|   |   |-- layers
|   |   |   `-- events.layer.json
|   |   |-- strings.json
|   |   `-- world.json
|   |-- moon-map-photos
|   |   |-- assets
|   |   |   |-- moon
|   |   |   |   `-- day-00.svg .. day-29.svg  (30 phase icons)
|   |   |   `-- photos
|   |   |       |-- thumbs/  (96 thumbnail .jpg files)
|   |   |       `-- (96 full-size .jpg files)
|   |   |-- data
|   |   |   `-- photos.geojson
|   |   |-- layers
|   |   |   `-- photos.layer.json
|   |   |-- strings.json
|   |   `-- world.json
|   `-- paranormal-spain
|       |-- data
|       |   |-- categories.json
|       |   |-- lugares.geojson
|       |   |-- regions.geojson
|       |   `-- verification-levels.json
|       |-- layers
|       |   |-- lugares.layer.json
|       |   `-- regions.layer.json
|       |-- strings.json
|       `-- world.json
|-- .gitattributes
|-- .gitignore
|-- .prettierignore
|-- .prettierrc.json
|-- CHANGELOG.md
|-- CONTEXT.md
|-- eslint.config.js
|-- feature-request-world-def.md
|-- index.html
|-- package.json
|-- pnpm-lock.yaml
|-- pnpm-workspace.yaml
|-- README.md
|-- ROADMAP.md
|-- tree.md
|-- tsconfig.json
`-- vite.config.ts
```
