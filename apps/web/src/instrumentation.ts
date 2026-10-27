// Runs once when the server starts: load plugin settings saved by the super admin.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadPlatformSettings } = await import("./lib/platform-plugins");
    await loadPlatformSettings(true);
  }
}
