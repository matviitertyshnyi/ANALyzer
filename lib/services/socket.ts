import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';

let io: SocketServer | null = null;

export function initializeSocket(server: HttpServer) {
  io = new SocketServer(server, {
    cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });
  
  console.log('Socket.IO initialized');
  return io;
}

export function getIO(): SocketServer {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}
