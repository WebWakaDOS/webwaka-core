/**
 * CORE-10: Universal Booking & Scheduling Engine
 * Blueprint Reference: Part 10.3 (Transport), Part 10.7 (Health)
 * 
 * Unified system for managing time slots, availability, and reservations.
 */

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
}

export interface Booking {
  id: string;
  resourceId: string;
  userId: string;
  slot: TimeSlot;
  status: 'pending' | 'confirmed' | 'cancelled';
}

export class BookingEngine {
  private bookings: Booking[] = [];

  /**
   * Checks if a resource is available for a given time slot.
   */
  isAvailable(resourceId: string, requestedSlot: TimeSlot): boolean {
    const resourceBookings = this.bookings.filter(b => 
      b.resourceId === resourceId && b.status !== 'cancelled'
    );

    for (const booking of resourceBookings) {
      // Check for overlap
      if (
        requestedSlot.startTime < booking.slot.endTime &&
        requestedSlot.endTime > booking.slot.startTime
      ) {
        return false; // Overlap found
      }
    }

    return true;
  }

  /**
   * Creates a new booking if the resource is available.
   */
  createBooking(resourceId: string, userId: string, slot: TimeSlot): Booking {
    if (!this.isAvailable(resourceId, slot)) {
      throw new Error('Resource is not available for the requested time slot');
    }

    const newBooking: Booking = {
      id: `bk_${crypto.randomUUID()}`,
      resourceId,
      userId,
      slot,
      status: 'confirmed'
    };

    this.bookings.push(newBooking);
    return newBooking;
  }

  /**
   * Cancels an existing booking.
   */
  cancelBooking(bookingId: string): boolean {
    const booking = this.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.status = 'cancelled';
      return true;
    }
    return false;
  }
}
