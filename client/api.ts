const token = () => document.querySelector<HTMLMetaElement>('meta[name="review-token"]')?.content ?? '';

export interface ApiResult<T = any> {
  ok: boolean;
  status: number;
  data: T;
}

export async function api<T = any>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', 'x-review-token': token() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  return { ok: res.ok, status: res.status, data };
}
