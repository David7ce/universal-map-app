import { describe, expect, it, vi, beforeEach } from 'vitest';
import { activatePlugins } from './activate';

const registerA = vi.fn();
const registerB = vi.fn();

const fakeModules = {
  '/plugins/a/index.ts': () => Promise.resolve({ default: registerA }),
  '/plugins/b/index.ts': () => Promise.resolve({ default: registerB }),
};

const strings = { greeting: 'hi' };

beforeEach(() => {
  registerA.mockClear();
  registerB.mockClear();
});

describe('activatePlugins', () => {
  it('throws naming an unknown plugin id', async () => {
    await expect(activatePlugins({ nonexistent: {} }, strings, fakeModules)).rejects.toThrow(/nonexistent/);
  });

  it("calls a known plugin module's register with exactly the manifest config", async () => {
    const config = { foo: 'bar' };
    await activatePlugins({ a: config }, strings, fakeModules);
    expect(registerA).toHaveBeenCalledWith(config, strings);
  });

  it('activates every declared plugin', async () => {
    await activatePlugins({ a: { x: 1 }, b: { y: 2 } }, strings, fakeModules);
    expect(registerA).toHaveBeenCalledWith({ x: 1 }, strings);
    expect(registerB).toHaveBeenCalledWith({ y: 2 }, strings);
  });

  it('does nothing when plugins is undefined', async () => {
    await expect(activatePlugins(undefined, strings, fakeModules)).resolves.toBeUndefined();
    expect(registerA).not.toHaveBeenCalled();
  });
});
