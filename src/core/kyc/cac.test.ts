import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncCACRegistry } from './cac';

const VALID_RC = '1234567';
const VALID_RC_PREFIXED = 'RC1234567';

describe('syncCACRegistry — CAC Company Registry KYB', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ── Format validation ────────────────────────────────────────────────────────

  it('rejects an RC Number with fewer than 4 digits', async () => {
    const result = await syncCACRegistry('123');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Invalid RC Number format/);
  });

  it('rejects an RC Number with more than 8 digits', async () => {
    const result = await syncCACRegistry('123456789');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Invalid RC Number format/);
  });

  it('rejects an RC Number with non-digit characters after the prefix', async () => {
    const result = await syncCACRegistry('RC12AB56');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Invalid RC Number format/);
  });

  it('rejects an empty string', async () => {
    const result = await syncCACRegistry('');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Invalid RC Number format/);
  });

  // ── Normalization ────────────────────────────────────────────────────────────

  it('normalizes a bare digit RC Number to "RC<digits>" form', async () => {
    const result = await syncCACRegistry(VALID_RC, {});
    // Should normalize even though env is missing
    expect(result.rcNumber).toBe('RC1234567');
  });

  it('normalizes a lowercase "rc" prefix to uppercase "RC"', async () => {
    const result = await syncCACRegistry('rc1234567', {});
    expect(result.rcNumber).toBe('RC1234567');
  });

  it('accepts an already-normalized "RC<digits>" RC Number', async () => {
    const result = await syncCACRegistry(VALID_RC_PREFIXED, {});
    expect(result.rcNumber).toBe('RC1234567');
  });

  // ── Missing credentials ──────────────────────────────────────────────────────

  it('returns a not-configured error when both credentials are absent', async () => {
    const result = await syncCACRegistry(VALID_RC, {});
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });

  it('returns a not-configured error when only CAC_API_KEY is set', async () => {
    const result = await syncCACRegistry(VALID_RC, { CAC_API_KEY: 'key' });
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });

  it('returns a not-configured error when only CAC_API_URL is set', async () => {
    const result = await syncCACRegistry(VALID_RC, { CAC_API_URL: 'https://api.example.test' });
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });

  // ── API interaction ──────────────────────────────────────────────────────────

  const env = { CAC_API_KEY: 'test-key', CAC_API_URL: 'https://api.cac.example.test' };

  it('calls the CAC API with normalized RC Number and correct headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: true, company: { rcNumber: 'RC1234567', companyName: 'Acme Ltd', companyType: 'LLC', registrationDate: '2010-01-15', status: 'ACTIVE' } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    await syncCACRegistry(VALID_RC, env);

    expect(mockFetch).toHaveBeenCalledWith(
      `${env.CAC_API_URL}/company/verify`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': `Bearer ${env.CAC_API_KEY}` }),
      })
    );
  });

  it('returns verified=true and company data on a successful API response', async () => {
    const company = {
      rcNumber: 'RC1234567',
      companyName: 'Acme Nigeria Ltd',
      companyType: 'LLC',
      registrationDate: '2010-01-15',
      status: 'ACTIVE',
      address: '1 Marina Street, Lagos',
      directors: ['John Doe', 'Jane Smith'],
    } as const;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: true, company }),
    }));

    const result = await syncCACRegistry(VALID_RC, env);

    expect(result.verified).toBe(true);
    expect(result.company).toMatchObject(company);
    expect(result.error).toBeUndefined();
  });

  it('returns verified=false when API responds OK but verified=false (struck-off company)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: false }),
    }));

    const result = await syncCACRegistry(VALID_RC, env);
    expect(result.verified).toBe(false);
    expect(result.company).toBeUndefined();
  });

  it('returns an error when the API responds with a non-OK HTTP status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => 'Company not found',
    }));

    const result = await syncCACRegistry(VALID_RC, env);
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/CAC API error 404/);
  });

  it('returns an error when fetch throws a network exception', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network timeout')));

    const result = await syncCACRegistry(VALID_RC, env);
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Network timeout/);
  });

  it('returns the normalized rcNumber in the result regardless of outcome', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('fail')));
    const result = await syncCACRegistry('1234567', env);
    expect(result.rcNumber).toBe('RC1234567');
  });

  it('accepts 4-digit minimum RC Numbers', async () => {
    const result = await syncCACRegistry('1234', {});
    expect(result.rcNumber).toBe('RC1234');
    expect(result.error).toMatch(/not configured/);
  });

  it('accepts 8-digit maximum RC Numbers', async () => {
    const result = await syncCACRegistry('12345678', {});
    expect(result.rcNumber).toBe('RC12345678');
    expect(result.error).toMatch(/not configured/);
  });
});
