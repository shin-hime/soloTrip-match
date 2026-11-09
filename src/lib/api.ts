// Single place where the frontend talks to the backend.
// When NEXT_PUBLIC_API_URL is empty (or NEXT_PUBLIC_USE_MOCK=true) every call returns mock data,
// so the UI is fully usable before the Express API exists. Endpoint shapes are documented in
// docs/API_CONTRACT.md — hand that file to the backend developer.
import { useAuth } from "@/store/auth";
import type {
  AppNotification, AuthResponse, Conversation, DirectMessage, MatchedTraveler, MatchFilters,
  NewGroupInput, NewTripInput, Trip, TripGroup, User, UserReport, ReportStatus,
} from "@/types";
import {
  mockConversations, mockGroups, mockMatches, mockMe, mockMessages, mockNotifications,
  mockReports, mockTrip, newMockMessageId,
} from "./mock";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true" || !API_URL;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; json?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token;
  const res = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
  });
  if (res.status === 401) useAuth.getState().logout();
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? res.statusText, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const wait = <T,>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));

const qs = (f: MatchFilters) => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return;
    p.set(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  // ---- auth
  login: (email: string, password: string): Promise<AuthResponse> =>
    USE_MOCK ? wait({ token: "mock-token", user: mockMe }) : request("/auth/login", { method: "POST", json: { email, password } }),
  register: (full_name: string, email: string, password: string): Promise<AuthResponse> =>
    USE_MOCK
      ? wait({ token: "mock-token", user: { ...mockMe, full_name, email } })
      : request("/auth/register", { method: "POST", json: { full_name, email, password } }),
  me: (): Promise<User> => (USE_MOCK ? wait(mockMe) : request("/auth/me")),
  oauthUrl: (provider: "google" | "facebook") => `${API_URL}/auth/${provider}`,

  // ---- trips & matching
  myActiveTrip: (): Promise<Trip | null> => (USE_MOCK ? wait(mockTrip) : request("/trips/mine/active")),
  createTrip: (input: NewTripInput): Promise<Trip> =>
    USE_MOCK
      ? wait({ ...mockTrip, ...input, trip_id: Date.now(), status: "active" as const, created_at: new Date().toISOString() })
      : request("/trips", { method: "POST", json: input }),
  matches: (filters: MatchFilters): Promise<MatchedTraveler[]> =>
    USE_MOCK ? wait(mockMatches) : request(`/matches${qs(filters)}`),
  sendChatRequest: (receiver_id: number): Promise<void> =>
    USE_MOCK ? wait(undefined, 150) : request("/chat-requests", { method: "POST", json: { receiver_id } }),

  // ---- messaging
  conversations: (): Promise<Conversation[]> => (USE_MOCK ? wait([...mockConversations]) : request("/conversations")),
  messages: (conversationId: number): Promise<DirectMessage[]> =>
    USE_MOCK ? wait([...(mockMessages[conversationId] ?? [])], 150) : request(`/conversations/${conversationId}/messages`),
  sendMessage: (conversationId: number, content: string): Promise<DirectMessage> => {
    if (!USE_MOCK) return request(`/conversations/${conversationId}/messages`, { method: "POST", json: { content } });
    const conv = mockConversations.find((c) => c.conversation_id === conversationId)!;
    const msg: DirectMessage = {
      message_id: newMockMessageId(), conversation_id: conversationId, sender_id: mockMe.user_id,
      receiver_id: conv.other_user.user_id, content, is_read: false, sent_at: new Date().toISOString(),
    };
    (mockMessages[conversationId] ??= []).push(msg);
    conv.last_message_text = content;
    conv.last_message_at = msg.sent_at;
    return wait(msg, 100);
  },
  markRead: (conversationId: number): Promise<void> => {
    if (!USE_MOCK) return request(`/conversations/${conversationId}/read`, { method: "PATCH" });
    const conv = mockConversations.find((c) => c.conversation_id === conversationId);
    if (conv) conv.unread_count = 0;
    return wait(undefined, 50);
  },

  // ---- groups
  groups: (): Promise<TripGroup[]> => (USE_MOCK ? wait([...mockGroups]) : request("/groups")),
  createGroup: (input: NewGroupInput): Promise<TripGroup> => {
    if (!USE_MOCK) return request("/groups", { method: "POST", json: input });
    const g: TripGroup = {
      ...input, group_id: Date.now(), creator_id: mockMe.user_id, cover_image_url: null,
      created_at: new Date().toISOString(), is_member: true,
      members: [{ user_id: mockMe.user_id, full_name: "You", avatar_url: null, role: "owner" }],
    };
    mockGroups.unshift(g);
    return wait(g);
  },
  joinGroup: (id: number): Promise<void> => {
    if (!USE_MOCK) return request(`/groups/${id}/join`, { method: "POST" });
    const g = mockGroups.find((x) => x.group_id === id);
    if (g && !g.is_member && g.members.length < g.max_members) {
      g.is_member = true;
      g.members.push({ user_id: mockMe.user_id, full_name: "You", avatar_url: null, role: "member" });
    }
    return wait(undefined, 150);
  },
  leaveGroup: (id: number): Promise<void> => {
    if (!USE_MOCK) return request(`/groups/${id}/leave`, { method: "DELETE" });
    const g = mockGroups.find((x) => x.group_id === id);
    if (g) {
      g.is_member = false;
      g.members = g.members.filter((m) => m.user_id !== mockMe.user_id && m.full_name !== "You");
    }
    return wait(undefined, 150);
  },

  // ---- profile & safety
  updateMe: (patch: Partial<User>): Promise<User> => {
    if (!USE_MOCK) return request("/users/me", { method: "PATCH", json: patch });
    Object.assign(mockMe, patch);
    return wait({ ...mockMe }, 100);
  },
  reportUser: (reported_user_id: number, reason: string): Promise<void> =>
    USE_MOCK ? wait(undefined) : request("/reports", { method: "POST", json: { reported_user_id, reason } }),

  // ---- notifications
  notifications: (): Promise<AppNotification[]> =>
    USE_MOCK ? wait([...mockNotifications], 100) : request("/notifications"),
  markNotificationRead: (id: number): Promise<void> => {
    if (!USE_MOCK) return request(`/notifications/${id}/read`, { method: "PATCH" });
    const n = mockNotifications.find((x) => x.notification_id === id);
    if (n) n.is_read = true;
    return wait(undefined, 50);
  },

  // ---- admin
  adminReports: (): Promise<UserReport[]> => (USE_MOCK ? wait([...mockReports]) : request("/admin/reports")),
  adminUpdateReport: (id: number, status: ReportStatus): Promise<void> => {
    if (!USE_MOCK) return request(`/admin/reports/${id}`, { method: "PATCH", json: { status } });
    const r = mockReports.find((x) => x.report_id === id);
    if (r) r.status = status;
    return wait(undefined, 100);
  },
  adminSetUserActive: (userId: number, is_active: boolean): Promise<void> =>
    USE_MOCK ? wait(undefined) : request(`/admin/users/${userId}`, { method: "PATCH", json: { is_active } }),
};
