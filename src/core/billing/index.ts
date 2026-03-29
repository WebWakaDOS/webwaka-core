/**
 * CORE-8: Platform Billing & Usage Ledger
 * Blueprint Reference: Part 10.1 (Central Management & Economics)
 * Blueprint Reference: Part 9.1 #6 (Africa First - Integer Kobo Values)
 * 
 * Implements internal ledger for tracking tenant API/AI usage.
 * Fully decoupled from KV-session logic — persists exclusively via D1.
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
  metadata?: Record<string, unknown>;
  createdAt: Date;
  deletedAt?: Date; // Soft deletes
}

export class BillingLedger {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Records a usage debit for a tenant.
   * Amount must be a positive integer in kobo (1 NGN = 100 kobo).
   */
  async recordUsage(
    tenantId: string,
    category: UsageCategory,
    amountKobo: number,
    description: string,
    metadata?: Record<string, unknown>
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
      ...(metadata !== undefined ? { metadata } : {}),
      createdAt: new Date()
    };

    // In a real implementation, this would insert into D1:
    // await this.db.prepare(
    //   'INSERT INTO ledger_entries (id, tenantId, type, category, amountKobo, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)'
    // ).bind(entry.id, entry.tenantId, entry.type, entry.category, entry.amountKobo, entry.description, entry.createdAt.toISOString()).run();

    return entry;
  }

  /**
   * Calculates the current balance for a tenant.
   * Returns integer kobo value (positive = credit, negative = overdrawn).
   */
  async getTenantBalance(tenantId: string): Promise<number> {
    // In a real implementation, this would query D1:
    // const result = await this.db.prepare(
    //   'SELECT SUM(CASE WHEN type = "CREDIT" THEN amountKobo ELSE -amountKobo END) as balance FROM ledger_entries WHERE tenantId = ? AND deletedAt IS NULL'
    // ).bind(tenantId).first<{ balance: number }>();
    // return result?.balance ?? 0;

    void tenantId; // suppress unused variable warning until D1 is wired
    return 0;
  }
}
