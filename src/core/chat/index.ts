/**
 * CORE-13: Real-Time Chat & Communication
 * Blueprint Reference: Part 10 (All Verticals)
 * 
 * In-app messaging system with offline sync support.
 */

export interface Message {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'system';
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
}

export interface ChatChannel {
  id: string;
  participants: string[];
  metadata: Record<string, any>;
  createdAt: Date;
}

export class ChatEngine {
  private channels: Map<string, ChatChannel> = new Map();
  private messages: Map<string, Message[]> = new Map();

  /**
   * Creates a new chat channel between participants.
   */
  createChannel(participants: string[], metadata: Record<string, any> = {}): ChatChannel {
    const channel: ChatChannel = {
      id: `ch_${crypto.randomUUID()}`,
      participants,
      metadata,
      createdAt: new Date()
    };
    
    this.channels.set(channel.id, channel);
    this.messages.set(channel.id, []);
    
    return channel;
  }

  /**
   * Sends a message to a channel.
   */
  sendMessage(channelId: string, senderId: string, content: string, type: 'text' | 'image' | 'system' = 'text'): Message {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error('Channel not found');

    if (!channel.participants.includes(senderId) && type !== 'system') {
      throw new Error('Sender is not a participant in this channel');
    }

    const message: Message = {
      id: `msg_${crypto.randomUUID()}`,
      channelId,
      senderId,
      content,
      type,
      status: 'sent',
      createdAt: new Date()
    };

    const channelMessages = this.messages.get(channelId) || [];
    channelMessages.push(message);
    this.messages.set(channelId, channelMessages);

    // In a real system, this would trigger a WebSocket event
    // eventBus.publish('chat.message.sent', message);

    return message;
  }

  /**
   * Retrieves messages for a channel.
   */
  getMessages(channelId: string, limit: number = 50, offset: number = 0): Message[] {
    const channelMessages = this.messages.get(channelId) || [];
    // Return latest messages first
    return [...channelMessages].reverse().slice(offset, offset + limit);
  }

  /**
   * Marks messages as read.
   */
  markAsRead(channelId: string, messageIds: string[]): void {
    const channelMessages = this.messages.get(channelId) || [];
    
    for (const msg of channelMessages) {
      if (messageIds.includes(msg.id)) {
        msg.status = 'read';
      }
    }
  }
}
