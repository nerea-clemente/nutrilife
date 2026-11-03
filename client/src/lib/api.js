export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, form, keepalive } = {}) {
  const opts = { method, credentials: 'same-origin', headers: {}, keepalive };
  if (form) opts.body = form;
  else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`/api${path}`, opts);
  if (res.status === 401 && !path.startsWith('/auth')) window.dispatchEvent(new Event('nl:unauthorized'));
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(data?.error || `Error ${res.status}`, res.status);
  return data;
}

export const photoUrl = (id, kind = 'thumb') => `/api/photos/${id}/${kind}`;
