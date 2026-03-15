/**
 * CORE-12: Universal KYC/KYB Verification
 * Blueprint Reference: Part 10.11 (Fintech), Part 10.3 (Transport)
 * 
 * Centralized identity verification system with Nigeria-First integrations.
 */

export interface KYCRequest {
  id: string;
  userId: string;
  documentType: 'NIN' | 'BVN' | 'PASSPORT' | 'DRIVERS_LICENSE';
  documentNumber: string;
  status: 'pending' | 'verified' | 'rejected';
  verifiedAt?: Date;
  rejectionReason?: string;
}

export class KYCEngine {
  private requests: Map<string, KYCRequest> = new Map();

  /**
   * Submits a new KYC verification request.
   */
  submitVerification(userId: string, documentType: 'NIN' | 'BVN' | 'PASSPORT' | 'DRIVERS_LICENSE', documentNumber: string): KYCRequest {
    const request: KYCRequest = {
      id: `kyc_${crypto.randomUUID()}`,
      userId,
      documentType,
      documentNumber,
      status: 'pending'
    };
    
    this.requests.set(request.id, request);
    return request;
  }

  /**
   * Processes a verification request (mocking external API calls to NIMC/NIBSS).
   */
  async processVerification(requestId: string): Promise<KYCRequest> {
    const request = this.requests.get(requestId);
    if (!request) throw new Error('KYC request not found');

    if (request.status !== 'pending') {
      throw new Error('Request is already processed');
    }

    // Mock external verification logic
    // In a real system, this would call NIMC for NIN or NIBSS for BVN
    const isValid = this.mockExternalVerification(request.documentNumber);

    if (isValid) {
      request.status = 'verified';
      request.verifiedAt = new Date();
    } else {
      request.status = 'rejected';
      request.rejectionReason = 'Document verification failed against national database';
    }

    return request;
  }

  /**
   * Retrieves the verification status for a user.
   */
  getUserVerificationStatus(userId: string): KYCRequest[] {
    return Array.from(this.requests.values()).filter(r => r.userId === userId);
  }

  private mockExternalVerification(documentNumber: string): boolean {
    // Mock logic: fail if document number starts with '000'
    return !documentNumber.startsWith('000');
  }
}
