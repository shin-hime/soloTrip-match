// Single place where the frontend talks to the backend.
// When NEXT_PUBLIC_API_URL is empty (or NEXT_PUBLIC_USE_MOCK=true) every call returns mock data,
// so the UI is fully usable before the Express API exists.
import { useAuth } from "@/store/auth";
import type {
  AppNotification, AuthResponse, Conversation, DirectMessage, GroupMessage, MatchedTraveler, MatchFilters,
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
    throw new ApiError(body.error ?? body.message ?? res.statusText, res.status);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const wait = <T,>(value: T, ms = 250) => new Promise<T>((r) => setTimeout(() => r(value), ms));

const normalizeUser = (u: Partial<User>): User => ({
  user_id: Number(u.user_id ?? 0),
  full_name: u.full_name ?? "",
  email: u.email ?? "",
  auth_provider: u.auth_provider ?? "email",
  age: u.age != null ? Number(u.age) : null,
  origin_location: u.origin_location ?? null,
  avatar_url: u.avatar_url ?? null,
  cover_photo_url: u.cover_photo_url ?? null,
  bio: u.bio ?? null,
  budget_range: u.budget_range ?? null,
  rating: Number(u.rating ?? 0),
  trips_count: Number(u.trips_count ?? 0),
  matches_count: Number(u.matches_count ?? 0),
  is_verified: Boolean(u.is_verified),
  hide_contact_info: Boolean(u.hide_contact_info),
  last_seen_at: u.last_seen_at ?? null,
  travel_styles: Array.isArray(u.travel_styles) ? u.travel_styles : [],
  interests: Array.isArray(u.interests) ? u.interests : [],
  is_active: u.is_active !== false,
  role: u.role ?? "traveler",
  created_at: u.created_at ?? "",
  updated_at: u.updated_at ?? "",
});

const normalizeTrip = (t: Partial<Trip>): Trip => ({
  trip_id: Number(t.trip_id ?? 0),
  user_id: Number(t.user_id ?? 0),
  destination: t.destination ?? "",
  traveling_from: t.traveling_from ?? null,
  departure_date: String(t.departure_date ?? "").slice(0, 10),
  return_date: String(t.return_date ?? "").slice(0, 10),
  budget_usd: t.budget_usd != null ? Number(t.budget_usd) : null,
  looking_for_count: Number(t.looking_for_count ?? 1),
  status: (t.status ?? "active") as Trip["status"],
  created_at: t.created_at ?? "",
});

const normalizeMatch = (m: Partial<MatchedTraveler>): MatchedTraveler => ({
  user_id: Number(m.user_id ?? 0),
  full_name: m.full_name ?? "",
  age: m.age != null ? Number(m.age) : null,
  avatar_url: m.avatar_url ?? null,
  rating: Number(m.rating ?? 0),
  trips_count: Number(m.trips_count ?? 0),
  bio: m.bio ?? null,
  interests: Array.isArray(m.interests) ? m.interests : [],
  travel_styles: Array.isArray(m.travel_styles) ? m.travel_styles : [],
  destination: m.destination ?? "",
  departure_date: String(m.departure_date ?? "").slice(0, 10),
  return_date: String(m.return_date ?? "").slice(0, 10),
  budget_usd: m.budget_usd != null ? Number(m.budget_usd) : null,
});

const normalizeGroup = (g: Partial<TripGroup>): TripGroup => ({
  group_id: Number(g.group_id ?? 0),
  creator_id: Number(g.creator_id ?? 0),
  destination: g.destination ?? "",
  start_date: String(g.start_date ?? "").slice(0, 10),
  end_date: String(g.end_date ?? "").slice(0, 10),
  max_members: Number(g.max_members ?? 5),
  cover_image_url: g.cover_image_url ?? null,
  created_at: g.created_at ?? "",
  members: Array.isArray(g.members) ? g.members : [],
  is_member: Boolean(g.is_member),
});

const toFrontendReportStatus = (s: string): ReportStatus => {
  if (s === "pending") return "open";
  if (s === "reviewed") return "reviewing";
  if (s === "resolved" || s === "dismissed") return s;
  return "open";
};

const toBackendReportStatus = (s: ReportStatus): "reviewed" | "resolved" =>
  s === "reviewing" || s === "open" ? "reviewed" : "resolved";

const discoverQs = (f: MatchFilters, tripId?: number) => {
  const p = new URLSearchParams();

  if (tripId != null) p.set("trip_id", String(tripId));
  if (f.budget_max != null) p.set("budget_max", String(f.budget_max));
  if (f.styles?.length) p.set("style", f.styles[0]);
  if (f.interests?.length) p.set("interest", f.interests[0]);

  const s = p.toString();
  return s ? `?${s}` : "";
};

export const api = {
  // ---- auth
  login: (email: string, password: string): Promise<AuthResponse> =>
    USE_MOCK
      ? wait({ token: "mock-token", user: mockMe })
      : request<AuthResponse>("/auth/login", { method: "POST", json: { email, password } })
          .then((r) => ({ token: r.token, user: normalizeUser(r.user) })),
  register: (full_name: string, email: string, password: string): Promise<AuthResponse> =>
    USE_MOCK
      ? wait({ token: "mock-token", user: { ...mockMe, full_name, email } })
      : request<AuthResponse>("/auth/register", { method: "POST", json: { full_name, email, password } })
          .then((r) => ({ token: r.token, user: normalizeUser(r.user) })),
  me: (): Promise<User> =>
    USE_MOCK ? wait(mockMe) : request<Partial<User>>("/profile").then(normalizeUser),
  oauthUrl: (provider: "google" | "facebook") => `${API_URL}/auth/${provider}`,

  // ---- trips & matching
  myTrips: (): Promise<Trip[]> => {
  if (USE_MOCK) return wait([mockTrip]);

  return request<Partial<Trip>[]>("/trips/mine").then((rows) =>
    Array.isArray(rows) ? rows.map(normalizeTrip) : []
  );
},

myActiveTrip: (): Promise<Trip | null> => {
  if (USE_MOCK) return wait(mockTrip);

  return request<Partial<Trip>[]>("/trips/mine").then((rows) => {
    const list = Array.isArray(rows) ? rows.map(normalizeTrip) : [];
    return list.find((t) => String(t.status) === "open" || String(t.status) === "active") ?? list[0] ?? null;
  });
},
  createTrip: (input: NewTripInput): Promise<Trip> =>
    USE_MOCK
      ? wait({ ...mockTrip, ...input, trip_id: Date.now(), status: "active" as const, created_at: new Date().toISOString() })
      : request<Partial<Trip>>("/trips", { method: "POST", json: input }).then(normalizeTrip),
  matches: (filters: MatchFilters, tripId?: number): Promise<MatchedTraveler[]> => {
  if (USE_MOCK) return wait(mockMatches);

  return request<Partial<MatchedTraveler>[]>(
    `/discover${discoverQs(filters, tripId)}`
  ).then((rows) => {
    const list = Array.isArray(rows) ? rows.map(normalizeMatch) : [];

    return list.filter((m) => {
      if (filters.destination && m.destination.toLowerCase().trim() !== filters.destination.toLowerCase().trim()) return false;
      if (filters.from && filters.to && (m.return_date < filters.from || m.departure_date > filters.to)) return false;
      if (filters.budget_min != null && m.budget_usd != null && m.budget_usd < filters.budget_min) return false;
      return true;
    });
  });
},
  sendChatRequest: (receiver_id: number): Promise<void> =>
    USE_MOCK
      ? wait(undefined, 150)
      : request("/likes", { method: "POST", json: { user_id: receiver_id, action: "like" } }).then(() => undefined),

  // ---- messaging
  conversations: (): Promise<Conversation[]> => {
    if (USE_MOCK) return wait([...mockConversations]);
    return request<Conversation[] | { conversations?: Conversation[] }>("/chat/conversations").then((r) =>
      Array.isArray(r) ? r : Array.isArray(r?.conversations) ? r.conversations : []
    );
  },
  messages: (conversationId: number): Promise<DirectMessage[]> => {
    if (USE_MOCK) return wait([...(mockMessages[conversationId] ?? [])], 150);
    return request<Partial<DirectMessage>[]>(`/chat/${conversationId}/messages`).then((rows) =>
      Array.isArray(rows)
        ? rows.map((m) => ({
            message_id: Number(m.message_id ?? 0),
            conversation_id: Number(m.conversation_id ?? conversationId),
            sender_id: Number(m.sender_id ?? 0),
            receiver_id: Number(m.receiver_id ?? 0),
            content: m.content ?? "",
            is_read: Boolean(m.is_read ?? true),
            sent_at: m.sent_at ?? new Date().toISOString(),
          }))
        : []
    );
  },
  sendMessage: (conversationId: number, content: string): Promise<DirectMessage> => {
    if (!USE_MOCK) {
      return request<Partial<DirectMessage>>(`/chat/${conversationId}/messages`, { method: "POST", json: { content } }).then((m) => ({
        message_id: Number(m.message_id ?? Date.now()),
        conversation_id: Number(m.conversation_id ?? conversationId),
        sender_id: Number(m.sender_id ?? useAuth.getState().user?.user_id ?? 0),
        receiver_id: Number(m.receiver_id ?? 0),
        content: m.content ?? content,
        is_read: Boolean(m.is_read ?? false),
        sent_at: m.sent_at ?? new Date().toISOString(),
      }));
    }
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
    // GET /chat/:id/messages marks incoming messages read automatically on the backend.
    if (!USE_MOCK) return Promise.resolve();
    const conv = mockConversations.find((c) => c.conversation_id === conversationId);
    if (conv) conv.unread_count = 0;
    return wait(undefined, 50);
  },

  // ---- groups
  groups: (): Promise<TripGroup[]> =>
    USE_MOCK
      ? wait([...mockGroups])
      : request<Partial<TripGroup>[]>("/groups").then((rows) => (Array.isArray(rows) ? rows.map(normalizeGroup) : [])),
  group: (id: number): Promise<TripGroup> => {
    if (USE_MOCK) {
      const found = mockGroups.find((x) => x.group_id === id);
      if (!found) return Promise.reject(new ApiError("Group not found.", 404));
      return wait({ ...found });
    }
    return request<Partial<TripGroup>>(`/groups/${id}`).then(normalizeGroup);
  },
  groupMessages: (id: number): Promise<GroupMessage[]> => {
    if (USE_MOCK) return wait([]);
    return request<Partial<GroupMessage>[]>(`/groups/${id}/messages`).then((rows) =>
      Array.isArray(rows)
        ? rows.map((m) => ({
            message_id: Number(m.message_id ?? 0),
            group_id: Number(m.group_id ?? id),
            sender_id: Number(m.sender_id ?? 0),
            sender_name: m.sender_name ?? "Traveler",
            avatar_url: m.avatar_url ?? null,
            content: m.content ?? "",
            sent_at: m.sent_at ?? new Date().toISOString(),
          }))
        : []
    );
  },
  sendGroupMessage: (id: number, content: string): Promise<GroupMessage> => {
    const me = useAuth.getState().user;
    if (USE_MOCK) {
      return wait({
        message_id: Date.now(),
        group_id: id,
        sender_id: me?.user_id ?? mockMe.user_id,
        sender_name: me?.full_name ?? mockMe.full_name,
        avatar_url: me?.avatar_url ?? null,
        content,
        sent_at: new Date().toISOString(),
      }, 100);
    }
    return request<Partial<GroupMessage>>(`/groups/${id}/messages`, { method: "POST", json: { content } }).then((m) => ({
      message_id: Number(m.message_id ?? Date.now()),
      group_id: Number(m.group_id ?? id),
      sender_id: Number(m.sender_id ?? me?.user_id ?? 0),
      sender_name: m.sender_name ?? me?.full_name ?? "You",
      avatar_url: m.avatar_url ?? me?.avatar_url ?? null,
      content: m.content ?? content,
      sent_at: m.sent_at ?? new Date().toISOString(),
    }));
  },
  createGroup: (input: NewGroupInput): Promise<TripGroup> => {
    if (!USE_MOCK) {
      return request<Partial<TripGroup>>("/groups", { method: "POST", json: input }).then((r) =>
        normalizeGroup({ ...input, ...r, is_member: true })
      );
    }
    const g: TripGroup = {
      ...input, group_id: Date.now(), creator_id: mockMe.user_id, cover_image_url: null,
      created_at: new Date().toISOString(), is_member: true,
      members: [{ user_id: mockMe.user_id, full_name: "You", avatar_url: null, role: "owner" }],
    };
    mockGroups.unshift(g);
    return wait(g);
  },
  joinGroup: (id: number): Promise<void> => {
    if (!USE_MOCK) return request(`/groups/${id}/join`, { method: "POST" }).then(() => undefined);
    const g = mockGroups.find((x) => x.group_id === id);
    if (g && !g.is_member && g.members.length < g.max_members) {
      g.is_member = true;
      g.members.push({ user_id: mockMe.user_id, full_name: "You", avatar_url: null, role: "member" });
    }
    return wait(undefined, 150);
  },
  leaveGroup: (id: number): Promise<void> => {
    if (!USE_MOCK) return request(`/groups/${id}/leave`, { method: "POST" }).then(() => undefined);
    const g = mockGroups.find((x) => x.group_id === id);
    if (g) {
      g.is_member = false;
      g.members = g.members.filter((m) => m.user_id !== mockMe.user_id && m.full_name !== "You");
    }
    return wait(undefined, 150);
  },

  // ---- profile & safety
  updateMe: (patch: Partial<User>): Promise<User> => {
    
    if (!USE_MOCK) return request<Partial<User>>("/profile", { method: "PATCH", json: patch }).then(normalizeUser);
    Object.assign(mockMe, patch);
    return wait({ ...mockMe }, 100);
  },
  
  uploadProfileImage: async (file: File, type: "avatar" | "cover"): Promise<User> => {
    if (USE_MOCK) {
      throw new ApiError("Photo upload requires the backend.", 400);
    }

    const token = useAuth.getState().token;
    const formData = new FormData();

    formData.append("file", file);
    formData.append("type", type);

    const res = await fetch(`${API_URL}/profile/upload`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (res.status === 401) useAuth.getState().logout();

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error ?? "Photo upload failed.", res.status);
    }

    return normalizeUser(await res.json());
  },

  reportUser: (reported_user_id: number, reason: string): Promise<void> => {
    if (USE_MOCK) {
      const targetName =
        mockConversations.find((c) => c.other_user.user_id === reported_user_id)?.other_user.full_name ??
        mockMatches.find((m) => m.user_id === reported_user_id)?.full_name ??
        `User ${reported_user_id}`;

      mockReports.unshift({
        report_id: Date.now(),
        reporter_id: mockMe.user_id,
        reported_user_id,
        reporter_name: mockMe.full_name,
        reported_name: targetName,
        reason,
        status: "open",
        created_at: new Date().toISOString(),
      });

      return wait(undefined, 150);
    }

    return request("/safety/report", {
      method: "POST",
      json: { user_id: reported_user_id, reason },
    }).then(() => undefined);
  },

  blockUser: (blocked_user_id: number): Promise<void> => {
    if (USE_MOCK) {
      const convIdx = mockConversations.findIndex(
        (c) => c.other_user.user_id === blocked_user_id
      );
      if (convIdx !== -1) mockConversations.splice(convIdx, 1);

      const matchIdx = mockMatches.findIndex(
        (m) => m.user_id === blocked_user_id
      );
      if (matchIdx !== -1) mockMatches.splice(matchIdx, 1);

      return wait(undefined, 150);
    }

    return request("/safety/block", {
      method: "POST",
      json: { user_id: blocked_user_id },
    }).then(() => undefined);
  },


  // ---- notifications
  notifications: (): Promise<AppNotification[]> => {
    if (USE_MOCK) return wait([...mockNotifications], 100);
    return request<AppNotification[] | { unread?: number; items?: AppNotification[] }>("/notifications").then((r) =>
      Array.isArray(r) ? r : Array.isArray(r?.items) ? r.items : []
    );
  },
  markNotificationRead: (id: number): Promise<void> => {
    if (!USE_MOCK) return request("/notifications/read-all", { method: "POST" }).then(() => undefined);
    const n = mockNotifications.find((x) => x.notification_id === id);
    if (n) n.is_read = true;
    return wait(undefined, 50);
  },

  // ---- admin
  adminReports: (): Promise<UserReport[]> => {
    if (USE_MOCK) return wait([...mockReports]);
    return request<UserReport[]>("/admin/reports").then((rows) =>
      Array.isArray(rows)
        ? rows.map((r) => ({ ...r, status: toFrontendReportStatus(String(r.status)) }))
        : []
    );
  },
  adminUpdateReport: (id: number, status: ReportStatus): Promise<void> => {
    if (!USE_MOCK) {
      return request(`/admin/reports/${id}`, { method: "PUT", json: { status: toBackendReportStatus(status) } }).then(() => undefined);
    }
    const r = mockReports.find((x) => x.report_id === id);
    if (r) r.status = status;
    return wait(undefined, 100);
  },
  adminSetUserActive: (userId: number, is_active: boolean): Promise<void> =>
    USE_MOCK
      ? wait(undefined)
      : request(`/admin/users/${userId}/active`, { method: "PUT", json: { is_active } }).then(() => undefined),
};
