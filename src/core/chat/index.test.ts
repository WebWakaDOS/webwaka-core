import { describe, it, expect, beforeEach } from 'vitest';
import { ChatEngine } from './index';

describe('CORE-13: Real-Time Chat & Communication', () => {
  let chatEngine: ChatEngine;

  beforeEach(() => {
    chatEngine = new ChatEngine();
  });

  it('should create a chat channel', () => {
    const channel = chatEngine.createChannel(['user1', 'user2'], { type: 'support' });
    
    expect(channel.id).toBeDefined();
    expect(channel.participants).toContain('user1');
    expect(channel.participants).toContain('user2');
    expect(channel.metadata.type).toBe('support');
  });

  it('should send a message to a channel', () => {
    const channel = chatEngine.createChannel(['user1', 'user2']);
    
    const message = chatEngine.sendMessage(channel.id, 'user1', 'Hello, world!');
    
    expect(message.id).toBeDefined();
    expect(message.content).toBe('Hello, world!');
    expect(message.senderId).toBe('user1');
    expect(message.status).toBe('sent');
  });

  it('should not allow non-participants to send messages', () => {
    const channel = chatEngine.createChannel(['user1', 'user2']);
    
    expect(() => {
      chatEngine.sendMessage(channel.id, 'user3', 'Hello, world!');
    }).toThrow('Sender is not a participant in this channel');
  });

  it('should retrieve messages for a channel', () => {
    const channel = chatEngine.createChannel(['user1', 'user2']);
    
    chatEngine.sendMessage(channel.id, 'user1', 'Message 1');
    chatEngine.sendMessage(channel.id, 'user2', 'Message 2');
    chatEngine.sendMessage(channel.id, 'user1', 'Message 3');
    
    const messages = chatEngine.getMessages(channel.id);
    
    expect(messages.length).toBe(3);
    expect(messages[0].content).toBe('Message 3'); // Latest first
    expect(messages[2].content).toBe('Message 1');
  });

  it('should mark messages as read', () => {
    const channel = chatEngine.createChannel(['user1', 'user2']);
    
    const msg1 = chatEngine.sendMessage(channel.id, 'user1', 'Message 1');
    const msg2 = chatEngine.sendMessage(channel.id, 'user1', 'Message 2');
    
    chatEngine.markAsRead(channel.id, [msg1.id, msg2.id]);
    
    const messages = chatEngine.getMessages(channel.id);
    
    expect(messages[0].status).toBe('read');
    expect(messages[1].status).toBe('read');
  });
});
