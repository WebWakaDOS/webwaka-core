/**
 * NIBSS BVN Facial Matching Engine
 * Blueprint Reference: Advanced KYC — Phase 2
 *
 * Provides `matchBVNFace()` for Tier 3 KYC facial matching against
 * the BVN record held by the Nigeria Inter-Bank Settlement System (NIBSS).
 *
 * In production, set NIBSS_API_KEY and NIBSS_API_URL in the Worker environment.
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
 * Validates inputs locally, then calls the NIBSS facial matching API.
 * Returns a structured result — never throws for expected failure cases.
 *
 * @param bvn          The 11-digit Bank Verification Number.
 * @param imageBase64  Base64-encoded JPEG or PNG of the applicant's face.
 * @param env          Worker environment with NIBSS_API_KEY and NIBSS_API_URL.
 */
export async function matchBVNFace(
  bvn: string,
  imageBase64: string,
  env: NIBSSEnv = {},
): Promise<BVNFaceMatchResult> {
  if (!isValidBVNFormat(bvn)) {
    return {
      bvn,
      matched: false,
      error: 'Invalid BVN format: must be exactly 11 digits',
    };
  }

  if (!imageBase64 || imageBase64.trim().length === 0) {
    return {
      bvn,
      matched: false,
      error: 'Image data is required for facial matching',
    };
  }

  if (!env.NIBSS_API_KEY || !env.NIBSS_API_URL) {
    return {
      bvn,
      matched: false,
      error: 'NIBSS integration not configured: NIBSS_API_KEY and NIBSS_API_URL are required',
    };
  }

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
