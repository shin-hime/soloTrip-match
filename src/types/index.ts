// Types mirror the PostgreSQL ERD (tools_and_tech.pdf, "System Database Schema").
// Enum value lists are ASSUMPTIONS: the ERD names the enum types but not their values.

export type Role = "traveler" | "admin";
export type AuthProvider = "email" | "google" | "facebook";
export type TripStatus = "active" | "completed" | "cancelled";
export type RequestStatus = "pending" | "accepted" | "declined";
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export interface User {
  user_id: number;
  full_name: string;
  email: string;
  auth_provider: AuthProvider;
  age: number | null;
  origin_location: string | null;
  avatar_url: string | null;
  cover_photo_url: string | null;
  bio: string | null;
  budget_range: string | null;
  rating: number;
  trips_count: number;
  matches_count: number;
  is_verified: boolean;
  hide_contact_info: boolean;
  last_seen_at: string | null;
  travel_styles: string[];
  interests: string[];
  is_active: boolean;
  role: Role;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  trip_id: number;
  user_id: number;
  destination: string;
  traveling_from: string | null;
  departure_date: string; // YYYY-MM-DD
  return_date: string;
  budget_usd: number | null;
  looking_for_count: number;
  status: TripStatus;
  created_at: string;
}

export interface NewTripInput {
  destination: string;
  traveling_from: string;
  departure_date: string;
  return_date: string;
  budget_usd: number | null;
  looking_for_count: number;
  // The New Trip form collects these but the ERD has no trip columns for them.
  travel_styles: string[];
  interests: string[];
}

/** One card in Discover: a traveler joined with their overlapping trip. */
export interface MatchedTraveler {
  user_id: number;
  full_name: string;
  age: number | null;
  avatar_url: string | null;
  rating: number;
  trips_count: number;
  bio: string | null;
  interests: string[];
  travel_styles: string[];
  destination: string;
  departure_date: string;
  return_date: string;
  budget_usd: number | null;
}

export interface MatchFilters {
  destination?: string;
  from?: string;
  to?: string;
  budget_min?: number;
  budget_max?: number;
  styles?: string[];
  interests?: string[];
}

export interface ChatRequest {
  request_id: number;
  sender_id: number;
  receiver_id: number;
  status: RequestStatus;
  created_at: string;
}

export interface Conversation {
  conversation_id: number;
  other_user: {
    user_id: number;
    full_name: string;
    avatar_url: string | null;
    is_online: boolean;
    destination: string | null;
  };
  last_message_text: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface DirectMessage {
  message_id: number;
  conversation_id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  sent_at: string;
}

export interface GroupMember {
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

export interface TripGroup {
  group_id: number;
  creator_id: number;
  destination: string;
  start_date: string;
  end_date: string;
  max_members: number;
  cover_image_url: string | null;
  created_at: string;
  members: GroupMember[]; // joined from group_members
  is_member: boolean; // computed for the current user
}

export interface NewGroupInput {
  destination: string;
  start_date: string;
  end_date: string;
  max_members: number;
}

export interface AppNotification {
  notification_id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface UserReport {
  report_id: number;
  reporter_id: number;
  reported_user_id: number;
  reporter_name?: string;
  reported_name?: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
