import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingLedger, UsageCategory, LedgerEntryType } from './index';

describe('CORE-8: Platform Billing & Usage Ledger', () => {
  let billingLedger: BillingLedger;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue({ balance: 500000 }) // 5000 NGN
    };
    
    billingLedger = new BillingLedger(mockDb);
  });

  it('should record usage with integer kobo values', async () => {
    const entry = await billingLedger.recordUsage(
      'tenant-1',
      UsageCategory.AI_TOKENS,
      1500, // 15 NGN
      'OpenRouter GPT-4o-mini usage'
    );

    expect(entry.tenantId).toBe('tenant-1');
    expect(entry.type).toBe(LedgerEntryType.DEBIT);
    expect(entry.category).toBe(UsageCategory.AI_TOKENS);
    expect(entry.amountKobo).toBe(1500);
    expect(entry.description).toBe('OpenRouter GPT-4o-mini usage');
    expect(entry.id).toBeDefined();
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it('should reject non-integer kobo values', async () => {
    await expect(
      billingLedger.recordUsage('tenant-1', UsageCategory.AI_TOKENS, 1500.5, 'Invalid amount')
    ).rejects.toThrow('Amount must be a positive integer in kobo');
  });

  it('should reject negative kobo values', async () => {
    await expect(
      billingLedger.recordUsage('tenant-1', UsageCategory.AI_TOKENS, -100, 'Invalid amount')
    ).rejects.toThrow('Amount must be a positive integer in kobo');
  });
});
