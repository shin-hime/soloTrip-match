// Mock data so the UI runs before the Express API exists. Mutable on purpose
// (sending a message or joining a group updates these arrays).
import type {
  AppNotification, Conversation, DirectMessage, MatchedTraveler, Trip, TripGroup, User, UserReport,
} from "@/types";

const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60000).toISOString();
const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

export const mockMe: User = {
  user_id: 1, full_name: "Jamie Carter", email: "jamie@example.com", auth_provider: "email",
  age: 27, origin_location: "San Francisco", avatar_url: null, cover_photo_url: null,
  bio: "Adventure-driven traveler with a passion for local cuisine and hidden gems. I prefer slow travel — immersing myself in cultures rather than ticking off landmarks. 12 countries visited, 3 continents, and counting.",
  budget_range: "$600 – $1,200 / week", rating: 4.9, trips_count: 12, matches_count: 3,
  is_verified: true, hide_contact_info: false, last_seen_at: iso(0),
  travel_styles: ["Adventurous", "Immersive"],
  interests: ["Beach", "Hiking", "Food", "Photography", "Culture", "Diving"],
  is_active: true, role: "traveler", created_at: iso(100000), updated_at: iso(10),
};

export const mockTrip: Trip = {
  trip_id: 1, user_id: 1, destination: "Thailand", traveling_from: "San Francisco",
  departure_date: day(40), return_date: day(52), budget_usd: 800, looking_for_count: 2,
  status: "active", created_at: iso(5000),
};

export const mockMatches: MatchedTraveler[] = [
  { user_id: 2, full_name: "Alex Rivera", age: 27, avatar_url: null, rating: 4.9, trips_count: 12,
    bio: "Sun-chaser and street food enthusiast. Looking for someone to explore hidden beaches and night markets with.",
    interests: ["Beach", "Food", "Diving"], travel_styles: ["Adventurous"],
    destination: "Phuket, Thailand", departure_date: day(40), return_date: day(52), budget_usd: 800 },
  { user_id: 3, full_name: "Maya Chen", age: 29, avatar_url: null, rating: 4.8, trips_count: 9, bio: null,
    interests: ["Photography", "Culture"], travel_styles: ["Cultural"],
    destination: "Santorini, Greece", departure_date: day(38), return_date: day(48), budget_usd: 1000 },
  { user_id: 4, full_name: "James Park", age: 31, avatar_url: null, rating: 4.7, trips_count: 15, bio: null,
    interests: ["Yoga", "Hiking"], travel_styles: ["Mindful"],
    destination: "Bali, Indonesia", departure_date: day(60), return_date: day(74), budget_usd: 700 },
  { user_id: 5, full_name: "Sofia Mendez", age: 26, avatar_url: null, rating: 4.9, trips_count: 7, bio: null,
    interests: ["Art", "Cuisine"], travel_styles: ["Mid-range"],
    destination: "Amalfi Coast, Italy", departure_date: day(30), return_date: day(41), budget_usd: 1200 },
  { user_id: 6, full_name: "Tom Walsh", age: 33, avatar_url: null, rating: 4.6, trips_count: 20, bio: null,
    interests: ["History", "Matcha"], travel_styles: ["Cultural"],
    destination: "Kyoto, Japan", departure_date: day(70), return_date: day(85), budget_usd: 900 },
  { user_id: 7, full_name: "Leila Hassan", age: 28, avatar_url: null, rating: 4.8, trips_count: 11, bio: null,
    interests: ["Markets", "Desert"], travel_styles: ["Adventurous"],
    destination: "Marrakech, Morocco", departure_date: day(35), return_date: day(45), budget_usd: 650 },
];

export const mockConversations: Conversation[] = [
  { conversation_id: 1, other_user: { user_id: 2, full_name: "Alex Rivera", avatar_url: null, is_online: true, destination: "Phuket, Thailand" },
    last_message_text: "Hey! I saw you're also going to Phuket", last_message_at: iso(2), unread_count: 2 },
  { conversation_id: 2, other_user: { user_id: 3, full_name: "Maya Chen", avatar_url: null, is_online: true, destination: "Santorini, Greece" },
    last_message_text: "The sunset from Oia is absolutely incredible", last_message_at: iso(60), unread_count: 0 },
  { conversation_id: 3, other_user: { user_id: 5, full_name: "Sofia Mendez", avatar_url: null, is_online: false, destination: "Amalfi Coast, Italy" },
    last_message_text: "Should we book that sailing tour together?", last_message_at: iso(180), unread_count: 1 },
];

let nextMsgId = 100;
export const mockMessages: Record<number, DirectMessage[]> = {
  1: [{ message_id: 1, conversation_id: 1, sender_id: 2, receiver_id: 1, content: "Hey! I saw you're also going to Phuket 🏝️", is_read: false, sent_at: iso(2) }],
  2: [
    { message_id: 10, conversation_id: 2, sender_id: 3, receiver_id: 1, content: "Hey! I saw you're also going to Phuket 🏝️", is_read: true, sent_at: iso(70) },
    { message_id: 11, conversation_id: 2, sender_id: 1, receiver_id: 3, content: "Yes! Sep 10-22. Are your dates similar?", is_read: true, sent_at: iso(68) },
    { message_id: 12, conversation_id: 2, sender_id: 3, receiver_id: 1, content: "Exactly the same! This is fate 😄", is_read: true, sent_at: iso(67) },
    { message_id: 13, conversation_id: 2, sender_id: 1, receiver_id: 3, content: "I'm planning to hit Phi Phi Island and night markets in Patong", is_read: true, sent_at: iso(65) },
    { message_id: 14, conversation_id: 2, sender_id: 3, receiver_id: 1, content: "Oh I have a great local guide contact for Phi Phi! Want to team up?", is_read: true, sent_at: iso(64) },
    { message_id: 15, conversation_id: 2, sender_id: 1, receiver_id: 3, content: "Absolutely! Let's plan this together 🙌", is_read: true, sent_at: iso(62) },
  ],
  3: [{ message_id: 20, conversation_id: 3, sender_id: 5, receiver_id: 1, content: "Should we book that sailing tour together?", is_read: false, sent_at: iso(180) }],
};
export const newMockMessageId = () => nextMsgId++;

export const mockGroups: TripGroup[] = [
  { group_id: 1, creator_id: 2, destination: "Phuket, Thailand", start_date: day(40), end_date: day(45), max_members: 5, cover_image_url: null, created_at: iso(3000),
    is_member: false,
    members: [
      { user_id: 2, full_name: "Alex Rivera", avatar_url: null, role: "owner" },
      { user_id: 8, full_name: "May Lin", avatar_url: null, role: "member" },
      { user_id: 9, full_name: "John Ames", avatar_url: null, role: "member" },
    ] },
  { group_id: 2, creator_id: 10, destination: "Bali, Indonesia", start_date: day(60), end_date: day(67), max_members: 5, cover_image_url: null, created_at: iso(2000),
    is_member: true,
    members: [
      { user_id: 10, full_name: "Sara Holt", avatar_url: null, role: "owner" },
      { user_id: 11, full_name: "Mia Torres", avatar_url: null, role: "member" },
      { user_id: 1, full_name: "You", avatar_url: null, role: "member" },
    ] },
];

export const mockNotifications: AppNotification[] = [
  { notification_id: 1, user_id: 1, type: "chat_request", title: "New chat request", message: "Leila Hassan wants to connect.", is_read: false, created_at: iso(15) },
  { notification_id: 2, user_id: 1, type: "group", title: "Group update", message: "May Lin joined Phuket, Thailand.", is_read: true, created_at: iso(240) },
];

export const mockReports: UserReport[] = [
  { report_id: 1, reporter_id: 3, reported_user_id: 12, reporter_name: "Maya Chen", reported_name: "Dan Brooks", reason: "Asked for my phone number before we had matched.", status: "open", created_at: iso(300) },
];
