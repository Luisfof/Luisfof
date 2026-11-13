import type {
  AdminMetrics, ContactResponse, Listing, ListingInput, Meta, OwnedListing, Report, SearchParams, SearchResult, User,
} from '../shared/types';

export class ApiFail extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'moraa',
        ...(init.body && !isForm ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiFail(0, 'Sem conexão. Verifique sua internet e tente de novo.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiFail(res.status, data?.error ?? 'Algo deu errado. Tente novamente.', data?.fields);
  return data as T;
}
const body = (v: unknown) => JSON.stringify(v);

export function toQuery(p: SearchParams): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    q.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  return q.toString();
}

export const api = {
  meta: () => req<Meta>('/meta'),
  search: (p: SearchParams) => req<SearchResult>(`/listings?${toQuery(p)}`),
  featured: () => req<Listing[]>('/listings/featured'),
  listing: (slug: string) => req<Listing>(`/listings/${encodeURIComponent(slug)}`),
  contact: (id: string) => req<ContactResponse>(`/listings/${id}/contact`, { method: 'POST' }),
  report: (id: string, reason: string, details: string) =>
    req<unknown>(`/listings/${id}/report`, { method: 'POST', body: body({ reason, details }) }),
  me: () => req<{ user: User | null }>('/auth/me'),
  login: (email: string, password: string) => req<{ user: User }>('/auth/login', { method: 'POST', body: body({ email, password }) }),
  register: (v: { name: string; email: string; password: string; acceptTerms: boolean }) =>
    req<{ user: User }>('/auth/register', { method: 'POST', body: body(v) }),
  logout: () => req<unknown>('/auth/logout', { method: 'POST' }),
  deleteAccount: () => req<unknown>('/auth/account', { method: 'DELETE' }),
  myListings: () => req<OwnedListing[]>('/my/listings'),
  myListing: (id: string) => req<OwnedListing & { whatsapp?: string | null }>(`/my/listings/${id}`),
  createListing: (v: ListingInput) => req<OwnedListing>('/my/listings', { method: 'POST', body: body(v) }),
  updateListing: (id: string, v: ListingInput) => req<OwnedListing>(`/my/listings/${id}`, { method: 'PUT', body: body(v) }),
  setStatus: (id: string, status: 'pausado' | 'ativo') =>
    req<OwnedListing>(`/my/listings/${id}/status`, { method: 'POST', body: body({ status }) }),
  deleteListing: (id: string) => req<unknown>(`/my/listings/${id}`, { method: 'DELETE' }),
  uploadImages: (id: string, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('images', f));
    return req<OwnedListing>(`/my/listings/${id}/images`, { method: 'POST', body: fd });
  },
  deleteImage: (id: string, imageId: string) => req<unknown>(`/my/listings/${id}/images/${imageId}`, { method: 'DELETE' }),
  planInterest: (plan: string) => req<unknown>('/plans/interest', { method: 'POST', body: body({ plan }) }),
  admin: {
    metrics: () => req<AdminMetrics>('/admin/metrics'),
    listings: (status?: string) => req<OwnedListing[]>(`/admin/listings${status ? `?status=${status}` : ''}`),
    moderate: (id: string, action: string, note?: string) =>
      req<OwnedListing>(`/admin/listings/${id}/moderate`, { method: 'POST', body: body({ action, note }) }),
    remove: (id: string) => req<unknown>(`/admin/listings/${id}`, { method: 'DELETE' }),
    reports: (status?: string) => req<Report[]>(`/admin/reports${status ? `?status=${status}` : ''}`),
    resolve: (id: string, resolution: string) =>
      req<Report>(`/admin/reports/${id}/resolve`, { method: 'POST', body: body({ resolution }) }),
  },
};
