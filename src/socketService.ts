import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string;

  constructor() {
    // Use environment variable or default to localhost for development
    this.serverUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
  }

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(this.serverUrl, {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to server:', this.socket?.id);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });
    }
    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Queue management
  joinQueue(location: string = 'Global') {
    this.socket?.emit('join-queue', { location });
  }

  leaveQueue() {
    this.socket?.emit('leave-queue');
  }

  onQueueStatus(callback: (data: { position: number; total: number }) => void) {
    this.socket?.on('queue-status', callback);
  }

  onQueueLeft(callback: () => void) {
    this.socket?.on('queue-left', callback);
  }

  // Global queue status (for all users)
  onGlobalQueueStatus(callback: (data: { queueLength: number; totalOnline: number; timestamp: number }) => void) {
    this.socket?.on('global-queue-status', callback);
  }

  // Matching
  onMatched(callback: (data: { roomId: string; partnerId: string; startTime: number; duration: number }) => void) {
    this.socket?.on('matched', callback);
  }

  // Messaging
  sendMessage(message: string) {
    this.socket?.emit('send-message', { message });
  }

  onNewMessage(callback: (data: { userId: string; message: string; timestamp: number }) => void) {
    this.socket?.on('new-message', callback);
  }

  // Compliments
  submitCompliment(compliment: string) {
    this.socket?.emit('submit-compliment', { compliment });
  }

  onComplimentReceived(callback: (data: { from: string; compliment: string }) => void) {
    this.socket?.on('compliment-received', callback);
  }

  onConversationComplete(callback: (data: { roomId: string; votingId: string }) => void) {
    this.socket?.on('conversation-complete', callback);
  }

  // Voting
  getVotingData() {
    this.socket?.emit('get-voting-data');
  }

  onVotingData(callback: (data: any[]) => void) {
    this.socket?.on('voting-data', callback);
  }

  submitVote(votingId: string, choice: 1 | 2, voterId: string) {
    this.socket?.emit('submit-vote', { votingId, choice, voterId });
  }

  onVoteResults(callback: (data: { votingId: string; percentages: { choice1: number; choice2: number }; totalVotes: number; hasVoted: boolean }) => void) {
    this.socket?.on('vote-results', callback);
  }

  getVoteResults(votingId: string, hasVoted: boolean = false) {
    this.socket?.emit('get-vote-results', { votingId, hasVoted });
  }

  // Connection events
  onUserDisconnected(callback: (data: { userId: string }) => void) {
    this.socket?.on('user-disconnected', callback);
  }

  // Cleanup
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export const socketService = new SocketService();
