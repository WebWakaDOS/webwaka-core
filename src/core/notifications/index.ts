/**
 * CORE-7: Unified Notification Service
 * Blueprint Reference: Part 10.12 (Cross-Cutting Functional Modules)
 * Blueprint Reference: Part 9.1 #5 (Nigeria First - Yournotify, Termii)
 *
 * Implements event-driven email, SMS, and push notification dispatchers.
 * Includes T-FND-05: Termii Voice OTP fallback for high-failure-rate Nigerian telcos.
 */

import { logger } from '../logger/index.js';

export interface NotificationPayload {
  tenantId: string;
  userId: string;
  type: 'email' | 'sms' | 'push';
  recipient: string;
  subject?: string;
  body: string;
}

export interface NotificationConfig {
  yournotifyApiKey?: string;
  termiiApiKey?: string;
  termiiSenderId?: string;
}

// ─── Voice OTP Types ──────────────────────────────────────────────────────────

/**
 * Tenant configuration for OTP delivery.
 * API keys are sourced from KV (Tenant-as-Code invariant) — never hardcoded.
 */
export interface OtpTenantConfig {
  /** Termii API key, retrieved from tenant KV store. */
  termiiApiKey: string;
  /** Termii sender ID (alphanumeric, ≤11 chars). Defaults to 'WebWaka'. */
  termiiSenderId?: string;
  /** SMS message template. Use {{otp}} as the placeholder. Defaults to a sensible message. */
  messageTemplate?: string;
  /** Max voice PIN entry attempts (1–3). Defaults to 3. */
  voicePinAttempts?: number;
  /** Voice PIN validity in minutes (1–60). Defaults to 10. */
  voicePinTimeToLive?: number;
  /** Voice PIN length (4–10). Defaults to 6. */
  voicePinLength?: number;
}

/** The delivery channel used for OTP dispatch. */
export type OtpDeliveryChannel = 'sms' | 'voice';

/**
 * Result of a sendOTP call.
 * When voice fallback is triggered, `voicePin` carries the Termii-generated PIN
 * so the caller can update their stored OTP record to match what was spoken.
 */
export interface OtpDeliveryResult {
  success: boolean;
  channel: OtpDeliveryChannel | null;
  /**
   * The PIN spoken by Termii when voice channel was used.
   * Only present when `channel === 'voice'` and `success === true`.
   * Callers MUST update their stored OTP to this value.
   */
  voicePin?: string;
  error?: string;
}

// ─── Internal Termii API response shapes ─────────────────────────────────────

interface TermiiSmsResponse {
  message_id?: string;
  message?: string;
}

interface TermiiVoiceOtpResponse {
  pinId?: string;
  pin?: string;
  to?: string;
  smsStatus?: string;
}

// ─── Termii API URLs ──────────────────────────────────────────────────────────

const TERMII_SMS_URL = 'https://api.ng.termii.com/api/sms/send';
const TERMII_VOICE_OTP_URL = 'https://api.ng.termii.com/api/sms/otp/send/voice';

// ─── sendOTP (standalone, Nigeria-First) ─────────────────────────────────────

/**
 * T-FND-05: Send an OTP via SMS with automatic Voice OTP fallback.
 *
 * Delivery strategy:
 *   1. If `forceVoice` is true → skip SMS, call Termii Voice OTP directly.
 *   2. Otherwise → attempt SMS delivery.
 *   3. If SMS fails → automatically fall back to Termii Voice OTP.
 *
 * When voice is used, Termii generates its own PIN (spoken to the caller).
 * The `voicePin` field in the result carries this generated PIN — callers
 * MUST reconcile their stored OTP with `voicePin` to allow correct verification.
 *
 * @param phoneNumber  - E.164-style number (e.g. "2348012345678")
 * @param otpCode      - The OTP code to embed in the SMS message
 * @param config       - Tenant OTP config (API key sourced from KV, never hardcoded)
 * @param options      - `forceVoice`: bypass SMS and use voice immediately
 */
export async function sendOTP(
  phoneNumber: string,
  otpCode: string,
  config: OtpTenantConfig,
  options?: { forceVoice?: boolean }
): Promise<OtpDeliveryResult> {
  const forceVoice = options?.forceVoice ?? false;

  if (!forceVoice) {
    const smsResult = await attemptSmsDelivery(phoneNumber, otpCode, config);
    if (smsResult.success) {
      return smsResult;
    }
    logger.warn('T-FND-05: SMS OTP delivery failed — triggering Voice OTP fallback', {
      phoneNumber,
      smsError: smsResult.error,
    });
  } else {
    logger.info('T-FND-05: Voice OTP explicitly requested — skipping SMS', { phoneNumber });
  }

  return attemptVoiceOtpDelivery(phoneNumber, config);
}

/**
 * Attempt to send the OTP via Termii SMS (generic channel).
 */
async function attemptSmsDelivery(
  phoneNumber: string,
  otpCode: string,
  config: OtpTenantConfig
): Promise<OtpDeliveryResult> {
  const template = config.messageTemplate ?? 'Your WebWaka OTP is {{otp}}. It expires in 10 minutes. Do not share it with anyone.';
  const message = template.replace('{{otp}}', otpCode);
  const senderId = config.termiiSenderId ?? 'WebWaka';

  try {
    const res = await fetch(TERMII_SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: phoneNumber,
        from: senderId,
        sms: message,
        type: 'plain',
        channel: 'generic',
        api_key: config.termiiApiKey,
      }),
    });

    const data = (await res.json()) as TermiiSmsResponse;

    if (!res.ok) {
      return {
        success: false,
        channel: 'sms',
        error: data?.message ?? `Termii SMS error: HTTP ${res.status}`,
      };
    }

    logger.info('T-FND-05: SMS OTP dispatched successfully', { phoneNumber });
    return { success: true, channel: 'sms' };
  } catch (err: any) {
    return {
      success: false,
      channel: 'sms',
      error: err?.message ?? 'Unknown SMS fetch error',
    };
  }
}

/**
 * Attempt to send OTP via Termii Voice OTP API.
 * Termii generates its own PIN for the voice call; this PIN is returned
 * in `voicePin` so the caller can update their stored OTP record.
 */
async function attemptVoiceOtpDelivery(
  phoneNumber: string,
  config: OtpTenantConfig
): Promise<OtpDeliveryResult> {
  const pinAttempts = config.voicePinAttempts ?? 3;
  const pinTimeToLive = config.voicePinTimeToLive ?? 10;
  const pinLength = config.voicePinLength ?? 6;

  try {
    const res = await fetch(TERMII_VOICE_OTP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.termiiApiKey,
        phone_number: phoneNumber,
        pin_attempts: pinAttempts,
        pin_time_to_live: pinTimeToLive,
        pin_length: pinLength,
      }),
    });

    const data = (await res.json()) as TermiiVoiceOtpResponse;

    if (!res.ok) {
      logger.error('T-FND-05: Voice OTP delivery failed', { phoneNumber });
      return {
        success: false,
        channel: 'voice',
        error: `Termii Voice OTP error: HTTP ${res.status}`,
      };
    }

    logger.info('T-FND-05: Voice OTP dispatched successfully', { phoneNumber });
    return {
      success: true,
      channel: 'voice',
      ...(data?.pin !== undefined ? { voicePin: data.pin } : {}),
    };
  } catch (err: any) {
    logger.error('T-FND-05: Voice OTP fetch threw an exception', { phoneNumber }, err);
    return {
      success: false,
      channel: 'voice',
      error: err?.message ?? 'Unknown Voice OTP fetch error',
    };
  }
}

// ─── NotificationService (existing, extended with OTP) ────────────────────────

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  /**
   * Dispatches a notification based on its type.
   */
  async dispatch(payload: NotificationPayload): Promise<boolean> {
    switch (payload.type) {
      case 'email':
        return this.sendEmail(payload);
      case 'sms':
        return this.sendSms(payload);
      case 'push':
        return this.sendPush(payload);
      default:
        throw new Error(`Unsupported notification type: ${payload.type}`);
    }
  }

  /**
   * T-FND-05: Send an OTP with SMS-first, Voice-fallback delivery.
   * Delegates to the standalone `sendOTP` function using this service's Termii config.
   */
  async sendOTP(
    phoneNumber: string,
    otpCode: string,
    options?: { forceVoice?: boolean; messageTemplate?: string }
  ): Promise<OtpDeliveryResult> {
    if (!this.config.termiiApiKey) {
      logger.warn('T-FND-05: Termii API key missing — OTP not sent', { phoneNumber });
      return { success: false, channel: null, error: 'Termii API key not configured' };
    }

    return sendOTP(phoneNumber, otpCode, {
      termiiApiKey: this.config.termiiApiKey,
      ...(this.config.termiiSenderId !== undefined ? { termiiSenderId: this.config.termiiSenderId } : {}),
      ...(options?.messageTemplate !== undefined ? { messageTemplate: options.messageTemplate } : {}),
    }, options);
  }

  /**
   * Sends an email using Yournotify (Nigeria-First Service)
   */
  private async sendEmail(payload: NotificationPayload): Promise<boolean> {
    if (!this.config.yournotifyApiKey) {
      logger.warn('Yournotify API key missing. Email not sent.', {
        tenantId: payload.tenantId,
        recipient: payload.recipient,
      });
      return false;
    }

    try {
      const response = await fetch('https://api.yournotify.com/v1/campaigns/email', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.yournotifyApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: payload.recipient,
          subject: payload.subject || 'Notification from WebWaka',
          html: payload.body
        })
      });

      if (!response.ok) {
        throw new Error(`Yournotify API error: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to send email via Yournotify', { tenantId: payload.tenantId }, error as Error);
      return false;
    }
  }

  /**
   * Sends an SMS using Termii (Nigeria-First Service)
   */
  private async sendSms(payload: NotificationPayload): Promise<boolean> {
    if (!this.config.termiiApiKey) {
      logger.warn('Termii API key missing. SMS not sent.', {
        tenantId: payload.tenantId,
        recipient: payload.recipient,
      });
      return false;
    }

    try {
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: payload.recipient,
          from: this.config.termiiSenderId || 'WebWaka',
          sms: payload.body,
          type: 'plain',
          channel: 'generic',
          api_key: this.config.termiiApiKey
        })
      });

      if (!response.ok) {
        throw new Error(`Termii API error: ${response.statusText}`);
      }

      return true;
    } catch (error) {
      logger.error('Failed to send SMS via Termii', { tenantId: payload.tenantId }, error as Error);
      return false;
    }
  }

  /**
   * Sends a push notification (Mock implementation for now)
   */
  private async sendPush(payload: NotificationPayload): Promise<boolean> {
    logger.info('Push notification sent', {
      tenantId: payload.tenantId,
      recipient: payload.recipient,
      body: payload.body,
    });
    return true;
  }
}
