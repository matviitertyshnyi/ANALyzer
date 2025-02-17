import type { Server as SocketServer } from 'socket.io';

let socketInstance: SocketServer | null = null;

export const setSocketInstance = (io: SocketServer) => {
  socketInstance = io;
  console.log('Socket instance set');
};

export const getSocketInstance = () => {
  if (!socketInstance) {
    console.warn('Socket instance not initialized');
    return null;
  }
  return socketInstance;
};

export const emitTrainingProgress = (data: any) => {
  try {
    if (socketInstance) {
      socketInstance.emit('training_progress', data);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Failed to emit training progress:', error);
    return false;
  }
};
