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

## Current snapshot

The generated tree is intentionally not checked in: it goes stale whenever worlds or UI modules change. Run either command above from the repository root to print the current tree.
