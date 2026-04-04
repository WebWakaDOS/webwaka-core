/**
 * CAC Company Registry Sync — KYB (Know Your Business) Engine
 * Blueprint Reference: Phase 2 Advanced KYC — CAC Registry Sync
 *
 * Provides `syncCACRegistry()` for verifying Nigerian company registrations
 * via the Corporate Affairs Commission (CAC) API.
 *
 * Security: callers MUST supply either `ADMIN_API_KEY` or `TENANT_SECRET`
 * in the env. The function will return `{ verified: false }` with an
 * Unauthorized error message if neither is present — no PII is logged.
 *
 * PII Policy: this module NEVER passes RC Numbers, company names, director
 * names, or other sensitive business data to the platform logger. Only
 * non-PII operational status messages are emitted when logging is required.
 */

/** Registered company types as defined by the CAC. */
export type CACCompanyType =
  | 'LLC'                     // Limited Liability Company
  | 'PLC'                     // Public Limited Company
  | 'PARTNERSHIP'
  | 'SOLE_PROPRIETORSHIP'
  | 'INCORPORATED_TRUSTEE';  // NGOs / associations

/** Current registration status of the company. */
export type CACCompanyStatus =
  | 'ACTIVE'
  | 'STRUCK_OFF'
  | 'SUSPENDED'
  | 'IN_LIQUIDATION';

/** Structured company record returned by the CAC API on a successful lookup. */
export interface CACCompany {
  /** Normalized RC Number (e.g. "RC1234567") */
  rcNumber: string;
  /** Registered company name as held by the CAC */
  companyName: string;
  /** Legal entity type */
  companyType: CACCompanyType;
  /** ISO 8601 date of registration */
  registrationDate: string;
  /** Current registration status */
  status: CACCompanyStatus;
  /** Registered office address (if available) */
  address?: string;
  /** Names of directors or trustees on record (if available) */
  directors?: string[];
}

/** Result returned by `syncCACRegistry()`. */
export interface CACVerificationResult {
  /** The RC Number that was verified (normalized form) */
  rcNumber: string;
  /** Whether the company was confirmed as registered and active by the CAC */
  verified: boolean;
  /** Structured company data (present on successful verification) */
  company?: CACCompany;
  /** Human-readable error description (present on failure) */
  error?: string;
}

/** Worker environment bindings required by `syncCACRegistry()`. */
export interface CACEnv {
  /**
   * Platform admin API key — grants authority to invoke KYB primitives.
   * At least one of `ADMIN_API_KEY` or `TENANT_SECRET` is required.
   */
  ADMIN_API_KEY?: string;
  /**
   * Tenant-scoped secret — alternative to ADMIN_API_KEY for tenant-level auth.
   * At least one of `ADMIN_API_KEY` or `TENANT_SECRET` is required.
   */
  TENANT_SECRET?: string;
  /** API key for authenticating CAC registry requests */
  CAC_API_KEY?: string;
  /** Base URL of the CAC verification API */
  CAC_API_URL?: string;
}

/**
 * Validates the format of a CAC RC Number.
 * Accepts digits only (4–8 digits) or "RC" prefix followed by 4–8 digits,
 * case-insensitive (e.g. "RC1234567", "1234567", "rc123456").
 */
function isValidRCNumber(rcNumber: string): boolean {
  return /^(RC)?\d{4,8}$/i.test(rcNumber.trim());
}

/**
 * Normalises an RC Number to the canonical "RC<digits>" form.
 */
function normalizeRCNumber(rcNumber: string): string {
  const cleaned = rcNumber.trim().toUpperCase();
  return cleaned.startsWith('RC') ? cleaned : `RC${cleaned}`;
}

/**
 * syncCACRegistry — Verify a Nigerian company registration via the CAC API.
 *
 * Execution order:
 *   1. RC Number format validation
 *   2. Platform auth check (ADMIN_API_KEY or TENANT_SECRET)
 *   3. CAC integration credential check
 *   4. CAC API call
 *
 * Returns a structured result with company details on success.
 * Never throws for expected failure modes — all errors are captured in `result.error`.
 * No PII (RC Number, company name, directors) is ever passed to the platform logger.
 *
 * @param rcNumber  The company RC Number to verify (e.g. "RC1234567").
 * @param env       Worker environment bindings.
 */
export async function syncCACRegistry(
  rcNumber: string,
  env: CACEnv = {},
): Promise<CACVerificationResult> {
  // 1. RC Number format validation
  if (!isValidRCNumber(rcNumber)) {
    return {
      rcNumber,
      verified: false,
      error: 'Invalid RC Number format: must be 4–8 digits, optionally prefixed with "RC"',
    };
  }

  const normalized = normalizeRCNumber(rcNumber);

  // 2. Platform auth — ADMIN_API_KEY or TENANT_SECRET required
  if (!env.ADMIN_API_KEY && !env.TENANT_SECRET) {
    return {
      rcNumber: normalized,
      verified: false,
      error: 'Unauthorized: ADMIN_API_KEY or TENANT_SECRET is required to invoke KYB primitives',
    };
  }

  // 3. CAC integration credentials
  if (!env.CAC_API_KEY || !env.CAC_API_URL) {
    return {
      rcNumber: normalized,
      verified: false,
      error: 'CAC integration not configured: CAC_API_KEY and CAC_API_URL are required',
    };
  }

  // 4. CAC API call — business data sent only to the trusted CAC endpoint, never to logger
  try {
    const response = await fetch(`${env.CAC_API_URL}/company/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.CAC_API_KEY}`,
      },
      body: JSON.stringify({ rcNumber: normalized }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        rcNumber: normalized,
        verified: false,
        error: `CAC API error ${response.status}: ${text}`,
      };
    }

    const data = await response.json() as {
      verified: boolean;
      company?: CACCompany;
    };

    return {
      rcNumber: normalized,
      verified: data.verified,
      ...(data.company !== undefined && { company: data.company }),
    };
  } catch (err) {
    return {
      rcNumber: normalized,
      verified: false,
      error: err instanceof Error ? err.message : 'Unknown error during CAC verification',
    };
  }
}
