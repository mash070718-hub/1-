import { exportLibrary, mergeCatalog, parseLibrary, type LibraryData } from './library';

export interface CloudConfig { url: string; publishableKey: string }
interface Session { access_token: string; refresh_token: string; expires_at: number }
export interface Published { data: LibraryData | null; revision: number }
const SESSION_KEY = 'library-of-limbus:admin-session';
const DRAFT_REVISION_KEY = 'library-of-limbus:admin-draft-revision';
export const DRAFT_KEY = 'library-of-limbus:admin-draft:v1';
let config: CloudConfig | null = null;
let session: Session | null = null;
let refreshing: Promise<void> | null = null;

export async function configureCloud(): Promise<boolean> {
  const response = await fetch(new URL('cloud-config.json', document.baseURI), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('공용 저장소 설정 파일을 읽지 못했습니다. 잠시 후 다시 시도하세요.');
  const value = await response.json();
  if (!value.url || !value.publishableKey) return false;
  const url = new URL(value.url);
  if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.pathname !== '/') {
    throw new Error('Supabase 프로젝트 주소 설정을 확인해 주세요.');
  }
  validatePublicKey(value.publishableKey);
  config = { url: url.origin, publishableKey: value.publishableKey };
  try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null'); } catch { session = null; }
  return true;
}

function storeSession(value: Session | null) {
  session = value;
  if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  else sessionStorage.removeItem(SESSION_KEY);
}

async function request(path: string, options: RequestInit = {}, authenticated = false): Promise<unknown> {
  if (!config) throw new Error('공용 저장소 연결 설정이 필요합니다.');
  if (authenticated) await refreshSession();
  if (authenticated && !session) throw new Error('관리자로 다시 로그인해 주세요.');
  const response = await fetch(`${config.url}${path}`, {
    ...options, signal: AbortSignal.timeout(15000),
    headers: { apikey: config.publishableKey,
      ...(authenticated ? { Authorization: `Bearer ${session!.access_token}` } : {}),
      'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (body?.code === '40001') throw new Error('다른 화면에서 이미 게시했습니다. 공개 기록을 다시 불러온 뒤 변경 내용을 합쳐 게시하세요. 현재 편집본은 유지됩니다.');
    if (response.status === 401 || response.status === 403) throw new Error('로그인 또는 관리자 권한을 확인해 주세요.');
    throw new Error(`공용 저장소 요청 실패 (${response.status}). 연결 설정과 데이터베이스 설치를 확인해 주세요.`);
  }
  return body;
}

async function refreshSession() {
  if (!session || session.expires_at > Date.now() / 1000 + 60) return;
  if (!refreshing) refreshing = (async () => {
    try {
      const result = await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: JSON.stringify({ refresh_token: session!.refresh_token }),
      }) as Session & { expires_in: number };
      storeSession({ ...result, expires_at: Date.now() / 1000 + result.expires_in });
    } catch (error) { storeSession(null); throw error; }
  })().finally(() => { refreshing = null; });
  await refreshing;
}

export async function isAdmin(): Promise<boolean> {
  if (!session) return false;
  return await request('/rest/v1/rpc/is_library_admin', { method: 'POST', body: '{}' }, true) === true;
}

export async function login(email: string, password: string): Promise<void> {
  const result = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', body: JSON.stringify({ email, password }),
  }) as Session & { expires_in: number };
  storeSession({ ...result, expires_at: Date.now() / 1000 + result.expires_in });
  try {
    if (!await isAdmin()) throw new Error('이 계정에는 관리자 편집 권한이 없습니다.');
  } catch (error) { storeSession(null); throw error; }
}

export async function logout(): Promise<void> {
  try { if (session) await request('/auth/v1/logout', { method: 'POST' }, true); }
  finally { storeSession(null); }
}

export async function readPublished(): Promise<Published> {
  const rows = await request('/rest/v1/library_publication?id=eq.library&select=data,revision', { cache: 'no-store' }) as { data: unknown; revision: number }[];
  if (rows.length !== 1 || !Number.isSafeInteger(rows[0].revision)) throw new Error('공용 저장소가 준비되지 않았습니다. 데이터베이스 설치를 확인해 주세요.');
  return { data: rows[0].data === null ? null : mergeCatalog(parseLibrary(JSON.stringify(rows[0].data))), revision: rows[0].revision };
}

export async function publish(data: LibraryData, revision: number): Promise<number> {
  const checked = JSON.parse(exportLibrary(data));
  const result = await request('/rest/v1/rpc/publish_library', {
    method: 'POST', body: JSON.stringify({ document: checked, expected_revision: revision }),
  }, true);
  if (!Number.isSafeInteger(result)) throw new Error('게시 결과를 확인하지 못했습니다. 공개 기록을 새로 불러와 확인해 주세요.');
  return result as number;
}

export function saveDraft(data: LibraryData, revision: number) {
  localStorage.setItem(DRAFT_KEY, exportLibrary(data));
  localStorage.setItem(DRAFT_REVISION_KEY, String(revision));
}
export function readDraftRevision(): number {
  const raw = localStorage.getItem(DRAFT_REVISION_KEY);
  const value = raw === null ? 0 : Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
export function readDraft(): LibraryData | null {
  const value = localStorage.getItem(DRAFT_KEY);
  return value ? mergeCatalog(parseLibrary(value)) : null;
}

export function validatePublicKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || !key.trim()) throw new Error('공개 API 키 설정을 확인해 주세요.');
  if (key.startsWith('sb_publishable_')) return;
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.role === 'anon') return;
  } catch { /* Fail closed for invalid or privileged keys. */ }
  throw new Error('Publishable 또는 anon public 키만 사용하세요. secret/service_role 키는 사이트에 넣으면 안 됩니다.');
}
