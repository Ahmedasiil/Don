/** Map a web link from a notification (e.g. /app/bills) to the same screen in the app. */
const SCREENS = ['send', 'request', 'bills', 'cards', 'invest', 'markets', 'credit', 'rewards', 'travel', 'activity', 'security', 'verify', 'help', 'family', 'coach', 'profile', 'notifications'];
export function linkToRoute(link: string) {
  const m = link.match(/^\/app\/([a-z]+)/);
  if (!m) return link === '/app' ? '/' : '/notifications';
  return SCREENS.includes(m[1]) ? `/${m[1]}` : '/notifications';
}
