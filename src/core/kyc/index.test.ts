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
  });

  it('should verify a valid document', async () => {
    const request = kycEngine.submitVerification('user_1', 'BVN', '12345678901');
    const processed = await kycEngine.processVerification(request.id);
    
    expect(processed.status).toBe('verified');
    expect(processed.verifiedAt).toBeDefined();
  });

  it('should reject an invalid document', async () => {
    // Mock logic fails documents starting with '000'
    const request = kycEngine.submitVerification('user_1', 'NIN', '00012345678');
    const processed = await kycEngine.processVerification(request.id);
    
    expect(processed.status).toBe('rejected');
    expect(processed.rejectionReason).toBeDefined();
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
});
