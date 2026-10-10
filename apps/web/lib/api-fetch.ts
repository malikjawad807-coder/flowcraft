export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, code = 'UNKNOWN_ERROR', status = 500, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let cachedCsrfToken: string | null = null;
let csrfPromise: Promise<string | null> | null = null;

export async function getCsrfToken(forceRefresh = false): Promise<string | null> {
  if (cachedCsrfToken && !forceRefresh) {
    return cachedCsrfToken;
  }

  if (csrfPromise && !forceRefresh) {
    return csrfPromise;
  }

  csrfPromise = (async () => {
    try {
      const res = await fetch('/api/auth/csrf', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      cachedCsrfToken = data?.csrfToken || null;
      return cachedCsrfToken;
    } catch {
      return null;
    } finally {
      csrfPromise = null;
    }
  })();

  return csrfPromise;
}

export function clearCsrfToken(): void {
  cachedCsrfToken = null;
}

const PUBLIC_AUTH_PATHS = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
];

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // If request has a body and isn't FormData, ensure JSON content-type
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Attach CSRF token on state-changing requests
  if (isStateChanging) {
    const token = await getCsrfToken();
    if (token) {
      headers['x-csrf-token'] = token;
    }
  }

  const exec = async (activeHeaders: Record<string, string>): Promise<Response> => {
    return fetch(path, {
      ...options,
      headers: activeHeaders,
      credentials: 'include',
    });
  };

  let res = await exec(headers);

  // If CSRF token expired / invalid, refetch and retry once
  if (res.status === 403 && isStateChanging) {
    try {
      const clone = res.clone();
      const body = await clone.json();
      if (body?.error?.code === 'CSRF_INVALID_TOKEN') {
        const freshToken = await getCsrfToken(true);
        if (freshToken) {
          headers['x-csrf-token'] = freshToken;
          res = await exec(headers);
        }
      }
    } catch {
      // ignore clone error
    }
  }

  // Handle 401 Unauthorized
  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      const pathname = window.location.pathname;
      const isPublic = PUBLIC_AUTH_PATHS.some((p) => pathname.startsWith(p));
      if (!isPublic) {
        window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
      }
    }
  }

  // Parse response
  let json: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      json = await res.json();
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const errorData = json?.error || {};
    const message = errorData.message || res.statusText || 'Request failed';
    const code = errorData.code || `HTTP_${res.status}`;
    throw new ApiError(message, code, res.status, errorData.details);
  }

  // Return json or null for 204 No Content
  return json as T;
}
