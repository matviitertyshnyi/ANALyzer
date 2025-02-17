import { Server as SocketServer } from 'socket.io';
import { Server } from 'http';

let io: SocketServer;

export const initializeSocket = (server: Server) => {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected');
    
    socket.on('startTraining', (params) => {
      io.emit('trainingStatus', { 
        status: 'started',
        params 
      });
    });
  });

  return io;
};

export const emitTrainingProgress = (data: any) => {
  if (io) {
    io.emit('trainingProgress', data);
  }
};

export const emitTradeUpdate = (data: any) => {
  if (io) {
    io.emit('tradeUpdate', data);
  }
};
