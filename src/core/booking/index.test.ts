import { describe, it, expect, beforeEach } from 'vitest';
import { BookingEngine } from './index';

describe('CORE-10: Universal Booking & Scheduling Engine', () => {
  let bookingEngine: BookingEngine;

  beforeEach(() => {
    bookingEngine = new BookingEngine();
  });

  it('should create a booking if resource is available', () => {
    const slot = {
      startTime: new Date('2026-03-15T10:00:00Z'),
      endTime: new Date('2026-03-15T11:00:00Z')
    };

    const booking = bookingEngine.createBooking('res_1', 'user_1', slot);
    expect(booking.status).toBe('confirmed');
    expect(booking.resourceId).toBe('res_1');
  });

  it('should reject booking if resource is not available', () => {
    const slot1 = {
      startTime: new Date('2026-03-15T10:00:00Z'),
      endTime: new Date('2026-03-15T11:00:00Z')
    };

    const slot2 = {
      startTime: new Date('2026-03-15T10:30:00Z'), // Overlaps with slot1
      endTime: new Date('2026-03-15T11:30:00Z')
    };

    bookingEngine.createBooking('res_1', 'user_1', slot1);

    expect(() => {
      bookingEngine.createBooking('res_1', 'user_2', slot2);
    }).toThrow('Resource is not available for the requested time slot');
  });

  it('should allow booking after cancellation', () => {
    const slot = {
      startTime: new Date('2026-03-15T10:00:00Z'),
      endTime: new Date('2026-03-15T11:00:00Z')
    };

    const booking1 = bookingEngine.createBooking('res_1', 'user_1', slot);
    bookingEngine.cancelBooking(booking1.id);

    // Should succeed now
    const booking2 = bookingEngine.createBooking('res_1', 'user_2', slot);
    expect(booking2.status).toBe('confirmed');
  });
});
