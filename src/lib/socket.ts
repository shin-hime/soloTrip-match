import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/store/auth";
import { API_URL, USE_MOCK } from "./api";

let socket: Socket | null = null;

/** Lazily connects with the JWT. Returns null in mock mode. */
export function getSocket(): Socket | null {
  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (USE_MOCK || !socketUrl) return null;
  const token = useAuth.getState().token;
  if (!token) return null;
  if (!socket) {
    socket = io(socketUrl, { auth: { token }, transports: ["websocket"] });
  }
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
