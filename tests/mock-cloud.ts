import type { Page, BrowserContext } from '@playwright/test';
import type { LibraryData } from '../src/lib/library';
export const draftKey = 'library-of-limbus:admin-draft:v1';
export interface MockStore { data: LibraryData | null; revision: number }
export async function mockCloud(context: BrowserContext, store: MockStore = { data: null, revision: 0 }) {
  await context.route('**/cloud-config.json', (route) => route.fulfill({ json: {
    url: 'https://limbus-test.supabase.co', publishableKey: 'sb_publishable_test',
  } }));
  await context.route('https://limbus-test.supabase.co/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const admin = request.headers().authorization === 'Bearer admin-test-token';
    if (path === '/auth/v1/token') {
      const { email, password } = request.postDataJSON();
      if (password !== 'test-password') return route.fulfill({ status: 400, json: { error: 'invalid' } });
      return route.fulfill({ json: { access_token: email === 'admin@example.test' ? 'admin-test-token' : 'reader-test-token', refresh_token: 'refresh', expires_in: 3600 } });
    }
    if (path === '/auth/v1/logout') return route.fulfill({ json: {} });
    if (path === '/rest/v1/rpc/is_library_admin') return route.fulfill({ json: admin });
    if (path === '/rest/v1/library_publication') return route.fulfill({ json: [{ ...store }] });
    if (path === '/rest/v1/rpc/publish_library') {
      if (!admin) return route.fulfill({ status: 403, json: {} });
      const body = request.postDataJSON();
      if (body.expected_revision !== store.revision) return route.fulfill({ status: 409, json: { code: '40001' } });
      store.data = body.document; store.revision++;
      return route.fulfill({ json: store.revision });
    }
    return route.fulfill({ status: 404, json: {} });
  });
}
export async function prepareAdmin(page: Page) {
  await mockCloud(page.context());
  await page.addInitScript(() => sessionStorage.setItem('library-of-limbus:admin-session', JSON.stringify({
    access_token: 'admin-test-token', refresh_token: 'refresh', expires_at: Date.now() / 1000 + 3600,
  })));
}
