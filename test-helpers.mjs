// @ts-nocheck
import http from 'http';

/**
 * Discovers the active game dev server port dynamically.
 * Probes ports in order of preference, returning the first reachable URL.
 * Defaults to http://localhost:5174 if none respond in time.
 * @param {number[]} ports
 * @returns {Promise<string>}
 */
export async function getGameUrl(ports = [5174, 5173, 5175, 3000]) {
  for (const port of ports) {
    const url = `http://localhost:${port}`;
    const reachable = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(800, () => {
        req.destroy();
        resolve(false);
      });
    });
    if (reachable) return url;
  }
  return 'http://localhost:5174';
}

