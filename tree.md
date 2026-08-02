# Tree

Excluye `dist`, `docs`, `node_modules`, `.git`.

## Comando PowerShell

```powershell
function Show-Tree {
    param($Path = '.', $Prefix = '', $Exclude = @('dist','docs','node_modules','.git'))
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

## Comando Bash

```bash
show_tree() {
  local path="${1:-.}" prefix="${2:-}"
  local exclude=(dist docs node_modules .git)
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

## Resultado

```
|-- .github
|   `-- workflows
|       |-- ci.yml
|       `-- deploy-pages.yml
|-- apps
|   `-- demo
|       |-- data
|       |   |-- poi.geojson
|       |   `-- regions.geojson
|       |-- layers
|       |   |-- heatmap.layer.json
|       |   |-- poi.layer.json
|       |   `-- regions.layer.json
|       |-- app-manifest.json
|       `-- strings.json
|-- plugins
|   `-- participate
|       |-- index.ts
|       |-- links.test.ts
|       `-- links.ts
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
|   |   |   `-- manifests.test.ts
|   |   |-- plugins
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
|   |       |-- calendar-systems.ts
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
|   |   |   |-- info-field-format.test.ts
|   |   |   |-- info-field-format.ts
|   |   |   |-- LayerControl.ts
|   |   |   |-- PanelRight.ts
|   |   |   |-- search.test.ts
|   |   |   |-- search.ts
|   |   |   |-- SearchOverlay.ts
|   |   |   |-- SettingsControl.ts
|   |   |   |-- temporal-status.test.ts
|   |   |   `-- temporal-status.ts
|   |   |-- app-chrome.ts
|   |   |-- escape-html.test.ts
|   |   |-- escape-html.ts
|   |   |-- icons.ts
|   |   |-- strings.test.ts
|   |   `-- strings.ts
|   |-- main.ts
|   `-- styles.css
|-- .gitattributes
|-- .gitignore
|-- .prettierignore
|-- .prettierrc.json
|-- CHANGELOG.md
|-- eslint.config.js
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
