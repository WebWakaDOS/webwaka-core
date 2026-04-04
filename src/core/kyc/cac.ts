/**
 * CAC Company Registry Sync — KYB (Know Your Business) Engine
 * Blueprint Reference: Phase 2 Advanced KYC — CAC Registry Sync
 *
 * Provides `syncCACRegistry()` for verifying Nigerian company registrations
 * via the Corporate Affairs Commission (CAC) API.
 *
 * CAC is the federal agency that registers and regulates companies and
 * business names in Nigeria. RC Numbers uniquely identify registered entities.
 *
 * In production, set CAC_API_KEY and CAC_API_URL in the Worker environment.
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
 * Validates the RC Number format locally, then calls the CAC API to confirm
 * the company is registered and active. Returns a structured result with
 * company details on success.
 *
 * This function NEVER throws for expected failure modes — all errors are
 * captured in `result.error` so callers are never blocked by KYB failures.
 *
 * @param rcNumber  The company RC Number to verify (e.g. "RC1234567").
 * @param env       Worker environment with CAC_API_KEY and CAC_API_URL.
 */
export async function syncCACRegistry(
  rcNumber: string,
  env: CACEnv = {},
): Promise<CACVerificationResult> {
  if (!isValidRCNumber(rcNumber)) {
    return {
      rcNumber,
      verified: false,
      error: 'Invalid RC Number format: must be 4–8 digits, optionally prefixed with "RC"',
    };
  }

  const normalized = normalizeRCNumber(rcNumber);

  if (!env.CAC_API_KEY || !env.CAC_API_URL) {
    return {
      rcNumber: normalized,
      verified: false,
      error: 'CAC integration not configured: CAC_API_KEY and CAC_API_URL are required',
    };
  }

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
