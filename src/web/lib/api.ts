export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; admin?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(init.json);
  }
  if (init.admin) headers.set('X-Admin', '1');
  const res = await fetch(path, { ...init, headers, body, credentials: 'same-origin' });
  let data: any = null;
  try {
    data = await res.json();
  } catch { /* prázdná odpověď */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'error', data?.message);
  return data as T;
}
