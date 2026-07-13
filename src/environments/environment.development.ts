// The API runs on the same machine that serves this app in dev, so derive
// its host from wherever the browser loaded the app from. That way it works
// unchanged whether opened as http://localhost:4200 (→ localhost:5089) or
// from another machine on the LAN as http://192.168.x.x:4200 (→ that same
// host on :5089) — a LAN client's own "localhost" would be the wrong host.
// HTTP (not HTTPS): the dev cert is only valid for localhost, so HTTPS would
// break every LAN client with a cert error.
const apiHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

export const environment = {
  production: false,
  apiUrl: `http://${apiHost}:5089`,
};
