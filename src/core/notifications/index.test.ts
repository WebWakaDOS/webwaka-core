import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificationService,
  NotificationPayload,
  sendOTP,
  OtpTenantConfig,
} from './index';

// ─── Fetch mock ───────────────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeFetchResponse(ok: boolean, body: Record<string, unknown>) {
  return Promise.resolve({
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
});

// ─── Existing NotificationService tests ──────────────────────────────────────

describe('CORE-7: Unified Notification Service (Nigeria-First)', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    notificationService = new NotificationService({
      yournotifyApiKey: 'yn-key-123',
      termiiApiKey: 'termii-key-456',
      termiiSenderId: 'WebWakaTest'
    });
  });

  it('should send email via Yournotify', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const payload: NotificationPayload = {
      tenantId: 't1',
      userId: 'u1',
      type: 'email',
      recipient: 'test@example.com',
      subject: 'Test Email',
      body: '<h1>Hello</h1>'
    };

    const result = await notificationService.dispatch(payload);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const fetchArgs = (mockFetch as any).mock.calls[0];
    expect(fetchArgs[0]).toBe('https://api.yournotify.com/v1/campaigns/email');
    expect(fetchArgs[1].headers['Authorization']).toBe('Bearer yn-key-123');

    const body = JSON.parse(fetchArgs[1].body);
    expect(body.to).toBe('test@example.com');
    expect(body.subject).toBe('Test Email');
  });

  it('should send SMS via Termii', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });

    const payload: NotificationPayload = {
      tenantId: 't1',
      userId: 'u1',
      type: 'sms',
      recipient: '2348012345678',
      body: 'Hello from WebWaka'
    };

    const result = await notificationService.dispatch(payload);

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const fetchArgs = (mockFetch as any).mock.calls[0];
    expect(fetchArgs[0]).toBe('https://api.ng.termii.com/api/sms/send');

    const body = JSON.parse(fetchArgs[1].body);
    expect(body.to).toBe('2348012345678');
    expect(body.from).toBe('WebWakaTest');
    expect(body.api_key).toBe('termii-key-456');
  });

  it('should fail gracefully if API keys are missing', async () => {
    const emptyService = new NotificationService({});

    const emailResult = await emptyService.dispatch({
      tenantId: 't1', userId: 'u1', type: 'email', recipient: 'test@example.com', body: 'test'
    });

    const smsResult = await emptyService.dispatch({
      tenantId: 't1', userId: 'u1', type: 'sms', recipient: '2348012345678', body: 'test'
    });

    expect(emailResult).toBe(false);
    expect(smsResult).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── T-FND-05: sendOTP standalone function ───────────────────────────────────

describe('T-FND-05: sendOTP — SMS-first, Voice-fallback (standalone)', () => {
  const config: OtpTenantConfig = {
    termiiApiKey: 'termii-kv-key-abc',
    termiiSenderId: 'WakaTest',
  };

  it('delivers OTP via SMS on first attempt and returns channel=sms', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, { message_id: 'sms-001' }));

    const result = await sendOTP('2348012345678', '123456', config);

    expect(result.success).toBe(true);
    expect(result.channel).toBe('sms');
    expect(result.voicePin).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.ng.termii.com/api/sms/send');

    const body = JSON.parse(init.body);
    expect(body.to).toBe('2348012345678');
    expect(body.sms).toContain('123456');
    expect(body.api_key).toBe('termii-kv-key-abc');
    expect(body.from).toBe('WakaTest');
    expect(body.channel).toBe('generic');
  });

  it('falls back to voice when SMS delivery fails (non-OK HTTP)', async () => {
    // SMS fails with HTTP 400
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse(false, { message: 'DND active on number' })
    );
    // Voice OTP succeeds
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse(true, { pinId: 'pin-voice-001', pin: '789012', to: '2348012345678' })
    );

    const result = await sendOTP('2348012345678', '123456', config);

    expect(result.success).toBe(true);
    expect(result.channel).toBe('voice');
    expect(result.voicePin).toBe('789012');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [voiceUrl, voiceInit] = mockFetch.mock.calls[1];
    expect(voiceUrl).toBe('https://api.ng.termii.com/api/sms/otp/send/voice');

    const voiceBody = JSON.parse(voiceInit.body);
    expect(voiceBody.phone_number).toBe('2348012345678');
    expect(voiceBody.api_key).toBe('termii-kv-key-abc');
    expect(voiceBody.pin_attempts).toBe(3);
    expect(voiceBody.pin_time_to_live).toBe(10);
    expect(voiceBody.pin_length).toBe(6);
  });

  it('falls back to voice when SMS fetch throws a network error', async () => {
    // SMS throws
    mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
    // Voice OTP succeeds
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse(true, { pinId: 'pin-voice-002', pin: '334455' })
    );

    const result = await sendOTP('2348099999999', '654321', config);

    expect(result.success).toBe(true);
    expect(result.channel).toBe('voice');
    expect(result.voicePin).toBe('334455');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('skips SMS and calls Voice OTP directly when forceVoice=true', async () => {
    mockFetch.mockResolvedValueOnce(
      makeFetchResponse(true, { pinId: 'pin-forced', pin: '111222', to: '2348011111111' })
    );

    const result = await sendOTP('2348011111111', '000000', config, { forceVoice: true });

    expect(result.success).toBe(true);
    expect(result.channel).toBe('voice');
    expect(result.voicePin).toBe('111222');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.ng.termii.com/api/sms/otp/send/voice');
  });

  it('returns failure if both SMS and Voice OTP fail', async () => {
    // SMS fails
    mockFetch.mockResolvedValueOnce(makeFetchResponse(false, { message: 'SMS failed' }));
    // Voice also fails
    mockFetch.mockResolvedValueOnce(makeFetchResponse(false, { message: 'Voice failed' }));

    const result = await sendOTP('2348012345678', '000000', config);

    expect(result.success).toBe(false);
    expect(result.channel).toBe('voice');
    expect(result.voicePin).toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns failure if both SMS and Voice OTP throw', async () => {
    mockFetch.mockRejectedValueOnce(new Error('SMS network error'));
    mockFetch.mockRejectedValueOnce(new Error('Voice network error'));

    const result = await sendOTP('2348012345678', '000000', config);

    expect(result.success).toBe(false);
    expect(result.channel).toBe('voice');
    expect(result.error).toBe('Voice network error');
  });

  it('embeds OTP in SMS using default message template', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, {}));

    await sendOTP('2348012345678', '998877', config);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sms).toContain('998877');
    expect(body.sms).toContain('WebWaka');
  });

  it('embeds OTP using a custom messageTemplate', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, {}));

    const customConfig: OtpTenantConfig = {
      ...config,
      messageTemplate: 'Kode OTP anda: {{otp}}. Jangan kongsi.',
    };

    await sendOTP('2348012345678', '112233', customConfig);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sms).toBe('Kode OTP anda: 112233. Jangan kongsi.');
  });

  it('passes custom voice OTP parameters from config', async () => {
    mockFetch.mockResolvedValueOnce(makeFetchResponse(false, { message: 'SMS fail' }));
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, { pin: '4321' }));

    const advancedConfig: OtpTenantConfig = {
      ...config,
      voicePinAttempts: 1,
      voicePinTimeToLive: 5,
      voicePinLength: 4,
    };

    const result = await sendOTP('2348012345678', '0000', advancedConfig);

    expect(result.success).toBe(true);
    const voiceBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(voiceBody.pin_attempts).toBe(1);
    expect(voiceBody.pin_time_to_live).toBe(5);
    expect(voiceBody.pin_length).toBe(4);
  });
});

// ─── T-FND-05: NotificationService.sendOTP method ────────────────────────────

describe('T-FND-05: NotificationService.sendOTP — class method', () => {
  it('sends OTP via SMS using service config', async () => {
    const svc = new NotificationService({
      termiiApiKey: 'svc-key-999',
      termiiSenderId: 'Waka',
    });

    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, {}));

    const result = await svc.sendOTP('2348087654321', '555666');

    expect(result.success).toBe(true);
    expect(result.channel).toBe('sms');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.api_key).toBe('svc-key-999');
    expect(body.sms).toContain('555666');
  });

  it('returns failure immediately when Termii API key is not configured', async () => {
    const svc = new NotificationService({});

    const result = await svc.sendOTP('2348012345678', '123456');

    expect(result.success).toBe(false);
    expect(result.channel).toBeNull();
    expect(result.error).toMatch(/not configured/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('falls back to voice via the class method when SMS fails', async () => {
    const svc = new NotificationService({ termiiApiKey: 'key-from-kv' });

    mockFetch.mockResolvedValueOnce(makeFetchResponse(false, { message: 'SMS fail' }));
    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, { pin: '246810' }));

    const result = await svc.sendOTP('2348012345678', '111111');

    expect(result.success).toBe(true);
    expect(result.channel).toBe('voice');
    expect(result.voicePin).toBe('246810');
  });

  it('supports forceVoice option via class method', async () => {
    const svc = new NotificationService({ termiiApiKey: 'key-from-kv' });

    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, { pin: '135790' }));

    const result = await svc.sendOTP('2348012345678', '999999', { forceVoice: true });

    expect(result.success).toBe(true);
    expect(result.channel).toBe('voice');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.ng.termii.com/api/sms/otp/send/voice');
  });

  it('uses custom messageTemplate from options', async () => {
    const svc = new NotificationService({ termiiApiKey: 'key-from-kv' });

    mockFetch.mockResolvedValueOnce(makeFetchResponse(true, {}));

    await svc.sendOTP('2348012345678', '777888', {
      messageTemplate: 'Token: {{otp}}',
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.sms).toBe('Token: 777888');
  });
});
