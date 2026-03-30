import { describe, it, expect, beforeEach } from 'vitest';
import { KYCEngine } from './index';

describe('CORE-12: Universal KYC/KYB Verification', () => {
  let kycEngine: KYCEngine;

  beforeEach(() => {
    kycEngine = new KYCEngine();
  });

  it('should submit a verification request', () => {
    const request = kycEngine.submitVerification('user_1', 'NIN', '12345678901');
    expect(request.status).toBe('pending');
    expect(request.userId).toBe('user_1');
    expect(request.documentType).toBe('NIN');
    expect(request.id).toMatch(/^kyc_/);
    expect(request.documentNumber).toBe('12345678901');
  });

  it('should verify a valid document', async () => {
    const request = kycEngine.submitVerification('user_1', 'BVN', '12345678901');
    const processed = await kycEngine.processVerification(request.id);

    expect(processed.status).toBe('verified');
    expect(processed.verifiedAt).toBeDefined();
    expect(processed.rejectionReason).toBeUndefined();
  });

  it('should reject an invalid document', async () => {
    const request = kycEngine.submitVerification('user_1', 'NIN', '00012345678');
    const processed = await kycEngine.processVerification(request.id);

    expect(processed.status).toBe('rejected');
    expect(processed.rejectionReason).toBeDefined();
    expect(processed.verifiedAt).toBeUndefined();
  });

  it('should retrieve user verification status', () => {
    kycEngine.submitVerification('user_1', 'NIN', '12345678901');
    kycEngine.submitVerification('user_1', 'BVN', '12345678901');
    kycEngine.submitVerification('user_2', 'NIN', '98765432109');

    const user1Status = kycEngine.getUserVerificationStatus('user_1');
    expect(user1Status).toHaveLength(2);

    const user2Status = kycEngine.getUserVerificationStatus('user_2');
    expect(user2Status).toHaveLength(1);
  });

  it('should return empty array for user with no verifications', () => {
    const status = kycEngine.getUserVerificationStatus('unknown_user');
    expect(status).toHaveLength(0);
  });

  it('should throw when processing a non-existent request', async () => {
    await expect(kycEngine.processVerification('kyc_nonexistent')).rejects.toThrow('KYC request not found');
  });

  it('should throw when processing an already-processed request', async () => {
    const request = kycEngine.submitVerification('user_1', 'BVN', '12345678901');
    await kycEngine.processVerification(request.id);

    await expect(kycEngine.processVerification(request.id)).rejects.toThrow('Request is already processed');
  });

  it('should support all valid document types', () => {
    const types = ['NIN', 'BVN', 'PASSPORT', 'DRIVERS_LICENSE'] as const;
    for (const type of types) {
      const request = kycEngine.submitVerification('user_x', type, '12345678901');
      expect(request.documentType).toBe(type);
    }
  });

  it('should assign unique IDs to each request', () => {
    const r1 = kycEngine.submitVerification('user_1', 'NIN', '11111111111');
    const r2 = kycEngine.submitVerification('user_1', 'BVN', '22222222222');
    expect(r1.id).not.toBe(r2.id);
  });
});
