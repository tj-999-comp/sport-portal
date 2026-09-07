function isAuthorized(request, env) {
  const header = request.headers.get('Authorization') || '';
  if (!header.startsWith('Basic ')) return false;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');
    return separator >= 0 && decoded.slice(0, separator) === env.BASIC_AUTH_USER && decoded.slice(separator + 1) === env.BASIC_AUTH_PASSWORD;
  } catch { return false; }
}

export async function onRequest({ request, env, next }) {
  if (!isAuthorized(request, env)) {
    return new Response('Authentication required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="sport-portal", charset="UTF-8"', 'Cache-Control': 'no-store' } });
  }
  return next();
}
