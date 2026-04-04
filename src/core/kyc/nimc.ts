/**
 * NIMC vNIN Verification Engine
 * Blueprint Reference: Advanced KYC — Phase 2
 *
 * Provides `verifyVNIN()` for validating Nigerian virtual National
 * Identification Numbers (vNIN) via the NIMC API.
 *
 * Security: callers MUST supply either `ADMIN_API_KEY` or `TENANT_SECRET`
 * in the env. The function will return `{ verified: false }` with an
 * Unauthorized error message if neither is present — no PII is logged.
 *
 * PII Policy: this module NEVER passes the raw vNIN, name, DOB, or any other
 * personal data to the platform logger. Only non-PII operational status
 * messages (e.g. auth failure) are emitted when logging is required.
 */

export interface VNINVerificationResult {
  /** The vNIN that was checked */
  vnin: string;
  /** Whether the vNIN was confirmed valid by NIMC */
  verified: boolean;
  /** First name as held by NIMC (present on success) */
  firstName?: string;
  /** Last name as held by NIMC (present on success) */
  lastName?: string;
  /** Date of birth in ISO 8601 format (present on success) */
  dateOfBirth?: string;
  /** Gender as held by NIMC (present on success) */
  gender?: 'M' | 'F';
  /** Human-readable error description (present on failure) */
  error?: string;
}

export interface NIMCEnv {
  /**
   * Platform admin API key — grants authority to invoke KYC primitives.
   * At least one of `ADMIN_API_KEY` or `TENANT_SECRET` is required.
   */
  ADMIN_API_KEY?: string;
  /**
   * Tenant-scoped secret — alternative to ADMIN_API_KEY for tenant-level auth.
   * At least one of `ADMIN_API_KEY` or `TENANT_SECRET` is required.
   */
  TENANT_SECRET?: string;
  /** NIMC API key for authenticating vNIN verification requests with NIMC */
  NIMC_API_KEY?: string;
  /** Base URL of the NIMC verification API */
  NIMC_API_URL?: string;
}

/**
 * Validates format of a vNIN string.
 * A vNIN is exactly 16 alphanumeric characters issued by NIMC.
 */
function isValidVNINFormat(vnin: string): boolean {
  return /^[A-Za-z0-9]{16}$/.test(vnin);
}

/**
 * verifyVNIN — Verify a Nigerian virtual National Identification Number.
 *
 * Execution order:
 *   1. Format validation (no auth required — cheap local check)
 *   2. Platform auth check (ADMIN_API_KEY or TENANT_SECRET)
 *   3. NIMC integration credential check
 *   4. NIMC API call
 *
 * Returns a structured result — never throws for expected failure cases.
 * No PII is ever passed to the platform logger.
 *
 * @param vnin  The 16-character vNIN to verify.
 * @param env   Worker environment bindings.
 */
export async function verifyVNIN(
  vnin: string,
  env: NIMCEnv = {},
): Promise<VNINVerificationResult> {
  // 1. Format validation
  if (!isValidVNINFormat(vnin)) {
    return {
      vnin,
      verified: false,
      error: 'Invalid vNIN format: must be exactly 16 alphanumeric characters',
    };
  }

  // 2. Platform auth — ADMIN_API_KEY or TENANT_SECRET required
  if (!env.ADMIN_API_KEY && !env.TENANT_SECRET) {
    return {
      vnin,
      verified: false,
      error: 'Unauthorized: ADMIN_API_KEY or TENANT_SECRET is required to invoke KYC primitives',
    };
  }

  // 3. NIMC integration credentials
  if (!env.NIMC_API_KEY || !env.NIMC_API_URL) {
    return {
      vnin,
      verified: false,
      error: 'NIMC integration not configured: NIMC_API_KEY and NIMC_API_URL are required',
    };
  }

  // 4. NIMC API call — PII (vnin) sent only to the trusted NIMC endpoint, never to logger
  try {
    const response = await fetch(`${env.NIMC_API_URL}/vnin/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.NIMC_API_KEY}`,
      },
      body: JSON.stringify({ vnin }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        vnin,
        verified: false,
        error: `NIMC API error ${response.status}: ${text}`,
      };
    }

    const data = await response.json() as {
      verified: boolean;
      firstName?: string;
      lastName?: string;
      dateOfBirth?: string;
      gender?: 'M' | 'F';
    };

    return {
      vnin,
      verified: data.verified,
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
      ...(data.gender !== undefined && { gender: data.gender }),
    };
  } catch (err) {
    return {
      vnin,
      verified: false,
      error: err instanceof Error ? err.message : 'Unknown error during NIMC verification',
    };
  }
}
