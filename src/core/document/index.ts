/**
 * CORE-11: Document & Contract Management
 * Blueprint Reference: Part 10.5 (Real Estate), Part 10.12 (Legal)
 * 
 * Secure system for generating, signing, and storing legal documents.
 */

export interface Document {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'pending_signature' | 'signed';
  signatures: Signature[];
  createdAt: Date;
}

export interface Signature {
  userId: string;
  timestamp: Date;
  ipAddress: string;
  hash: string;
}

export class DocumentEngine {
  private documents: Map<string, Document> = new Map();

  /**
   * Creates a new document from a template.
   */
  createDocument(title: string, content: string): Document {
    const doc: Document = {
      id: `doc_${crypto.randomUUID()}`,
      title,
      content,
      status: 'draft',
      signatures: [],
      createdAt: new Date()
    };
    this.documents.set(doc.id, doc);
    return doc;
  }

  /**
   * Requests signatures for a document.
   */
  requestSignatures(documentId: string): Document {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error('Document not found');
    
    if (doc.status !== 'draft') {
      throw new Error('Document must be in draft status to request signatures');
    }

    doc.status = 'pending_signature';
    return doc;
  }

  /**
   * Signs a document.
   */
  signDocument(documentId: string, userId: string, ipAddress: string): Document {
    const doc = this.documents.get(documentId);
    if (!doc) throw new Error('Document not found');

    if (doc.status !== 'pending_signature') {
      throw new Error('Document is not pending signature');
    }

    // Check if already signed by this user
    if (doc.signatures.some(s => s.userId === userId)) {
      throw new Error('User has already signed this document');
    }

    const signature: Signature = {
      userId,
      timestamp: new Date(),
      ipAddress,
      hash: this.generateSignatureHash(doc.content, userId, ipAddress)
    };

    doc.signatures.push(signature);

    // In a real system, we'd check if all required parties have signed
    // For this primitive, we'll mark it signed after one signature
    doc.status = 'signed';

    return doc;
  }

  private generateSignatureHash(content: string, userId: string, ipAddress: string): string {
    // Mock hash generation
    return `hash_${userId}_${Date.now()}`;
  }
}
