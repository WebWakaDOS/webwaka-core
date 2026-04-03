import { describe, it, expect, beforeEach } from 'vitest';
import { KYCEngine, verifyVNIN, matchBVNFace } from './index';

const T1 = 'tenant_alpha';
const T2 = 'tenant_beta';

describe('CORE-12: Universal KYC/KYB Verification', () => {
  let kycEngine: KYCEngine;

  beforeEach(() => {
    kycEngine = new KYCEngine();
  });

  it('should submit a verification request', () => {
    const request = kycEngine.submitVerification(T1, 'user_1', 'NIN', '12345678901');
    expect(request.status).toBe('pending');
    expect(request.tenantId).toBe(T1);
    expect(request.userId).toBe('user_1');
    expect(request.documentType).toBe('NIN');
    expect(request.id).toMatch(/^kyc_/);
    expect(request.documentNumber).toBe('12345678901');
  });

  it('should verify a valid document', async () => {
    const request = kycEngine.submitVerification(T1, 'user_1', 'BVN', '12345678901');
    const processed = await kycEngine.processVerification(T1, request.id);

    expect(processed.status).toBe('verified');
    expect(processed.verifiedAt).toBeDefined();
    expect(processed.rejectionReason).toBeUndefined();
  });

  it('should reject an invalid document', async () => {
    const request = kycEngine.submitVerification(T1, 'user_1', 'NIN', '00012345678');
    const processed = await kycEngine.processVerification(T1, request.id);

    expect(processed.status).toBe('rejected');
    expect(processed.rejectionReason).toBeDefined();
    expect(processed.verifiedAt).toBeUndefined();
  });

  it('should retrieve user verification status scoped to tenant', () => {
    kycEngine.submitVerification(T1, 'user_1', 'NIN', '12345678901');
    kycEngine.submitVerification(T1, 'user_1', 'BVN', '12345678901');
    kycEngine.submitVerification(T1, 'user_2', 'NIN', '98765432109');

    const user1Status = kycEngine.getUserVerificationStatus(T1, 'user_1');
    expect(user1Status).toHaveLength(2);

    const user2Status = kycEngine.getUserVerificationStatus(T1, 'user_2');
    expect(user2Status).toHaveLength(1);
  });

  it('should return empty array for user with no verifications', () => {
    const status = kycEngine.getUserVerificationStatus(T1, 'unknown_user');
    expect(status).toHaveLength(0);
  });

  it('should throw when processing a non-existent request', async () => {
    await expect(
      kycEngine.processVerification(T1, 'kyc_nonexistent')
    ).rejects.toThrow('KYC request not found');
  });

  it('should throw when processing an already-processed request', async () => {
    const request = kycEngine.submitVerification(T1, 'user_1', 'BVN', '12345678901');
    await kycEngine.processVerification(T1, request.id);

    await expect(
      kycEngine.processVerification(T1, request.id)
    ).rejects.toThrow('Request is already processed');
  });

  it('should support all valid document types', () => {
    const types = ['NIN', 'BVN', 'PASSPORT', 'DRIVERS_LICENSE'] as const;
    for (const type of types) {
      const request = kycEngine.submitVerification(T1, 'user_x', type, '12345678901');
      expect(request.documentType).toBe(type);
    }
  });

  it('should assign unique IDs to each request', () => {
    const r1 = kycEngine.submitVerification(T1, 'user_1', 'NIN', '11111111111');
    const r2 = kycEngine.submitVerification(T1, 'user_1', 'BVN', '22222222222');
    expect(r1.id).not.toBe(r2.id);
  });

  // ─── Cross-Tenant Isolation ───────────────────────────────────────────────

  it('cross-tenant: getUserVerificationStatus for tenant_A user returns empty for tenant_B', () => {
    kycEngine.submitVerification(T1, 'user_1', 'NIN', '12345678901');
    kycEngine.submitVerification(T1, 'user_1', 'BVN', '12345678901');

    const result = kycEngine.getUserVerificationStatus(T2, 'user_1');
    expect(result).toHaveLength(0);
  });

  it('cross-tenant: tenant_B cannot process a KYC request belonging to tenant_A', async () => {
    const request = kycEngine.submitVerification(T1, 'user_1', 'NIN', '12345678901');

    await expect(
      kycEngine.processVerification(T2, request.id)
    ).rejects.toThrow('KYC request not found');
  });
});

// ─── verifyVNIN ───────────────────────────────────────────────────────────────

describe('verifyVNIN — NIMC vNIN Verification', () => {
  it('rejects a vNIN that is too short', async () => {
    const result = await verifyVNIN('ABC123');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Invalid vNIN format/);
  });

  it('rejects a vNIN that is too long', async () => {
    const result = await verifyVNIN('ABCDEF1234567890X');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Invalid vNIN format/);
  });

  it('rejects a vNIN with special characters', async () => {
    const result = await verifyVNIN('ABCDEF12345678!@');
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/Invalid vNIN format/);
  });

  it('returns not-configured error when env credentials are absent', async () => {
    const result = await verifyVNIN('ABCDEF1234567890', {});
    expect(result.verified).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });

  it('returns the vnin in the result regardless of outcome', async () => {
    const vnin = 'ABCDEF1234567890';
    const result = await verifyVNIN(vnin, {});
    expect(result.vnin).toBe(vnin);
  });

  it('accepts a valid 16-character alphanumeric vNIN and attempts API call', async () => {
    const result = await verifyVNIN('ABCDEF1234567890', {
      NIMC_API_KEY: 'test-key',
      NIMC_API_URL: 'https://invalid.nimc.example.test',
    });
    expect(result.vnin).toBe('ABCDEF1234567890');
    expect(result.verified).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── matchBVNFace ─────────────────────────────────────────────────────────────

describe('matchBVNFace — NIBSS BVN Facial Matching', () => {
  it('rejects a BVN with fewer than 11 digits', async () => {
    const result = await matchBVNFace('1234567890', 'base64data');
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/Invalid BVN format/);
  });

  it('rejects a BVN with more than 11 digits', async () => {
    const result = await matchBVNFace('123456789012', 'base64data');
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/Invalid BVN format/);
  });

  it('rejects a BVN containing non-digit characters', async () => {
    const result = await matchBVNFace('1234567890A', 'base64data');
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/Invalid BVN format/);
  });

  it('rejects an empty image string', async () => {
    const result = await matchBVNFace('12345678901', '');
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/Image data is required/);
  });

  it('rejects a whitespace-only image string', async () => {
    const result = await matchBVNFace('12345678901', '   ');
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/Image data is required/);
  });

  it('returns not-configured error when env credentials are absent', async () => {
    const result = await matchBVNFace('12345678901', 'base64data', {});
    expect(result.matched).toBe(false);
    expect(result.error).toMatch(/not configured/);
  });

  it('returns the bvn in the result regardless of outcome', async () => {
    const bvn = '12345678901';
    const result = await matchBVNFace(bvn, 'base64data', {});
    expect(result.bvn).toBe(bvn);
  });

  it('accepts valid inputs and attempts the API call', async () => {
    const result = await matchBVNFace('12345678901', 'base64imagedata', {
      NIBSS_API_KEY: 'test-key',
      NIBSS_API_URL: 'https://invalid.nibss.example.test',
    });
    expect(result.bvn).toBe('12345678901');
    expect(result.matched).toBe(false);
    expect(result.error).toBeDefined();
  });
});
