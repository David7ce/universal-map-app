/// <reference types="vite/client" />

type PluginRegister = (config: unknown, strings: Record<string, string>) => void;
type PluginModuleMap = Record<string, () => Promise<{ default: PluginRegister }>>;

const modules: PluginModuleMap = import.meta.glob<{ default: PluginRegister }>('/plugins/*/index.ts');

export async function activatePlugins(
  plugins: Record<string, unknown> | undefined,
  strings: Record<string, string>,
  moduleMap: PluginModuleMap = modules,
): Promise<void> {
  for (const [id, config] of Object.entries(plugins ?? {})) {
    const path = `/plugins/${id}/index.ts`;
    const loadModule = moduleMap[path];
    if (!loadModule) {
      throw new Error(`App manifest declares unknown plugin "${id}" (no plugins/${id}/index.ts found)`);
    }
    const mod = await loadModule();
    mod.default(config, strings);
  }
}
