import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentEngine } from './index';

describe('CORE-11: Document & Contract Management', () => {
  let docEngine: DocumentEngine;

  beforeEach(() => {
    docEngine = new DocumentEngine();
  });

  it('should create a document in draft status', () => {
    const doc = docEngine.createDocument('Lease Agreement', 'Terms and conditions...');
    expect(doc.title).toBe('Lease Agreement');
    expect(doc.status).toBe('draft');
    expect(doc.signatures).toHaveLength(0);
  });

  it('should transition document to pending_signature', () => {
    const doc = docEngine.createDocument('Lease Agreement', 'Terms and conditions...');
    const updatedDoc = docEngine.requestSignatures(doc.id);
    expect(updatedDoc.status).toBe('pending_signature');
  });

  it('should allow signing a pending document', () => {
    const doc = docEngine.createDocument('Lease Agreement', 'Terms and conditions...');
    docEngine.requestSignatures(doc.id);
    
    const signedDoc = docEngine.signDocument(doc.id, 'user_1', '192.168.1.1');
    expect(signedDoc.status).toBe('signed');
    expect(signedDoc.signatures).toHaveLength(1);
    expect(signedDoc.signatures[0].userId).toBe('user_1');
    expect(signedDoc.signatures[0].ipAddress).toBe('192.168.1.1');
  });

  it('should reject signing a draft document', () => {
    const doc = docEngine.createDocument('Lease Agreement', 'Terms and conditions...');
    
    expect(() => {
      docEngine.signDocument(doc.id, 'user_1', '192.168.1.1');
    }).toThrow('Document is not pending signature');
  });
});
