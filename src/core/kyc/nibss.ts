/**
 * NIBSS BVN Facial Matching Engine
 * Blueprint Reference: Advanced KYC — Phase 2
 *
 * Provides `matchBVNFace()` for Tier 3 KYC facial matching against
 * the BVN record held by the Nigeria Inter-Bank Settlement System (NIBSS).
 *
 * Security: callers MUST supply either `ADMIN_API_KEY` or `TENANT_SECRET`
 * in the env. The function will return `{ matched: false }` with an
 * Unauthorized error message if neither is present — no PII is logged.
 *
 * PII Policy: this module NEVER passes the raw BVN, biometric image, or any
 * other personal data to the platform logger. Only non-PII operational status
 * messages are emitted when logging is required.
 */

export interface BVNFaceMatchResult {
  /** The BVN that was checked */
  bvn: string;
  /** Whether the supplied face image matched the BVN photo on record */
  matched: boolean;
  /** Similarity confidence score 0–100 (present on successful API call) */
  confidence?: number;
  /** Human-readable error description (present on failure) */
  error?: string;
}

export interface NIBSSEnv {
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
  /** NIBSS API key for authenticating BVN facial matching requests */
  NIBSS_API_KEY?: string;
  /** Base URL of the NIBSS verification API */
  NIBSS_API_URL?: string;
}

/**
 * Validates format of a BVN string.
 * A BVN is exactly 11 digits issued by the CBN/NIBSS.
 */
function isValidBVNFormat(bvn: string): boolean {
  return /^\d{11}$/.test(bvn);
}

/**
 * matchBVNFace — Match a base64-encoded face image against the BVN photo on record.
 *
 * Execution order:
 *   1. BVN format validation
 *   2. Image data validation
 *   3. Platform auth check (ADMIN_API_KEY or TENANT_SECRET)
 *   4. NIBSS integration credential check
 *   5. NIBSS API call
 *
 * Returns a structured result — never throws for expected failure cases.
 * No PII (BVN, biometric data) is ever passed to the platform logger.
 *
 * @param bvn          The 11-digit Bank Verification Number.
 * @param imageBase64  Base64-encoded JPEG or PNG of the applicant's face.
 * @param env          Worker environment bindings.
 */
export async function matchBVNFace(
  bvn: string,
  imageBase64: string,
  env: NIBSSEnv = {},
): Promise<BVNFaceMatchResult> {
  // 1. BVN format validation
  if (!isValidBVNFormat(bvn)) {
    return {
      bvn,
      matched: false,
      error: 'Invalid BVN format: must be exactly 11 digits',
    };
  }

  // 2. Image data validation
  if (!imageBase64 || imageBase64.trim().length === 0) {
    return {
      bvn,
      matched: false,
      error: 'Image data is required for facial matching',
    };
  }

  // 3. Platform auth — ADMIN_API_KEY or TENANT_SECRET required
  if (!env.ADMIN_API_KEY && !env.TENANT_SECRET) {
    return {
      bvn,
      matched: false,
      error: 'Unauthorized: ADMIN_API_KEY or TENANT_SECRET is required to invoke KYC primitives',
    };
  }

  // 4. NIBSS integration credentials
  if (!env.NIBSS_API_KEY || !env.NIBSS_API_URL) {
    return {
      bvn,
      matched: false,
      error: 'NIBSS integration not configured: NIBSS_API_KEY and NIBSS_API_URL are required',
    };
  }

  // 5. NIBSS API call — PII (bvn, image) sent only to the trusted NIBSS endpoint, never to logger
  try {
    const response = await fetch(`${env.NIBSS_API_URL}/bvn/face-match`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.NIBSS_API_KEY}`,
      },
      body: JSON.stringify({ bvn, image: imageBase64 }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        bvn,
        matched: false,
        error: `NIBSS API error ${response.status}: ${text}`,
      };
    }

    const data = await response.json() as {
      matched: boolean;
      confidence?: number;
    };

    return {
      bvn,
      matched: data.matched,
      ...(data.confidence !== undefined && { confidence: data.confidence }),
    };
  } catch (err) {
    return {
      bvn,
      matched: false,
      error: err instanceof Error ? err.message : 'Unknown error during NIBSS facial matching',
    };
  }
}
