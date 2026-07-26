export async function loadStrings(path: string | undefined): Promise<Record<string, string>> {
  if (!path) return {};
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load strings from ${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function t(key: string, strings: Record<string, string>): string {
  return strings[key] ?? key;
}
