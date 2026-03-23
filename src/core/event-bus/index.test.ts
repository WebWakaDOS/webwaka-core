import { describe, it, expect, vi } from 'vitest';
import { emitEvent } from './index';

describe('Event Bus', () => {
  it('should emit an event with the correct schema', async () => {
    const mockPut = vi.fn();
    const env = { EVENTS: { put: mockPut } as any };
    
    await emitEvent(env, 'test.event', 'tenant_1', { foo: 'bar' });
    
    expect(mockPut).toHaveBeenCalledTimes(1);
    const [key, value] = mockPut.mock.calls[0];
    
    expect(key).toMatch(/^event:tenant_1:test\.event:\d+:[a-z0-9]+$/);
    
    const parsed = JSON.parse(value);
    expect(parsed.event).toBe('test.event');
    expect(parsed.tenantId).toBe('tenant_1');
    expect(parsed.payload).toEqual({ foo: 'bar' });
    expect(typeof parsed.timestamp).toBe('number');
  });
});
