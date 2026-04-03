/**
 * NIMC vNIN Verification Engine
 * Blueprint Reference: Advanced KYC — Phase 2
 *
 * Provides `verifyVNIN()` for validating Nigerian virtual National
 * Identification Numbers (vNIN) via the NIMC API.
 *
 * In production, set NIMC_API_KEY and NIMC_API_URL in the Worker environment.
 * This module validates format locally and delegates verification to the API.
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
  /** NIMC API key for authenticating vNIN verification requests */
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
 * Validates format locally, then calls the NIMC API.
 * Returns a structured result — never throws for expected failure cases.
 *
 * @param vnin  The 16-character vNIN to verify.
 * @param env   Worker environment with NIMC_API_KEY and NIMC_API_URL.
 */
export async function verifyVNIN(
  vnin: string,
  env: NIMCEnv = {},
): Promise<VNINVerificationResult> {
  if (!isValidVNINFormat(vnin)) {
    return {
      vnin,
      verified: false,
      error: 'Invalid vNIN format: must be exactly 16 alphanumeric characters',
    };
  }

  if (!env.NIMC_API_KEY || !env.NIMC_API_URL) {
    return {
      vnin,
      verified: false,
      error: 'NIMC integration not configured: NIMC_API_KEY and NIMC_API_URL are required',
    };
  }

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
