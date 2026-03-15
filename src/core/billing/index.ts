/**
 * CORE-8: Platform Billing & Usage Ledger
 * Blueprint Reference: Part 10.1 (Central Management & Economics)
 * Blueprint Reference: Part 9.1 #6 (Africa First - Integer Kobo Values)
 * 
 * Implements internal ledger for tracking tenant API/AI usage.
 */

export enum LedgerEntryType {
  CREDIT = 'CREDIT',
  DEBIT = 'DEBIT'
}

export enum UsageCategory {
  AI_TOKENS = 'AI_TOKENS',
  SMS_SENT = 'SMS_SENT',
  EMAIL_SENT = 'EMAIL_SENT',
  SUBSCRIPTION_FEE = 'SUBSCRIPTION_FEE'
}

export interface LedgerEntry {
  id: string;
  tenantId: string;
  type: LedgerEntryType;
  category: UsageCategory;
  amountKobo: number; // Integer kobo values (Part 9.1 #6)
  description: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  deletedAt?: Date; // Soft deletes
}

export class BillingLedger {
  private db: any; // Type would be D1Database from @cloudflare/workers-types

  constructor(db: any) {
    this.db = db;
  }

  /**
   * Records a usage debit for a tenant.
   */
  async recordUsage(
    tenantId: string, 
    category: UsageCategory, 
    amountKobo: number, 
    description: string,
    metadata?: Record<string, any>
  ): Promise<LedgerEntry> {
    if (!Number.isInteger(amountKobo) || amountKobo < 0) {
      throw new Error('Amount must be a positive integer in kobo');
    }

    const entry: LedgerEntry = {
      id: crypto.randomUUID(),
      tenantId,
      type: LedgerEntryType.DEBIT,
      category,
      amountKobo,
      description,
      metadata,
      createdAt: new Date()
    };

    // In a real implementation, this would insert into D1
    // await this.db.prepare('INSERT INTO ledger_entries ...').bind(...).run();
    
    return entry;
  }

  /**
   * Calculates the current balance for a tenant.
   */
  async getTenantBalance(tenantId: string): Promise<number> {
    // In a real implementation, this would query D1
    // const result = await this.db.prepare('SELECT SUM(CASE WHEN type = "CREDIT" THEN amountKobo ELSE -amountKobo END) as balance FROM ledger_entries WHERE tenantId = ? AND deletedAt IS NULL').bind(tenantId).first();
    // return result.balance || 0;
    
    return 0; // Mock return
  }
}
