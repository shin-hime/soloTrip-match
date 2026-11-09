# TravelMate API contract (proposed)

Written from the ERD in `tools_and_tech.pdf` and what the six screens need. The frontend already calls
these endpoints in `src/lib/api.ts`; until `NEXT_PUBLIC_API_URL` is set it runs on mock data.
Change anything here and update `src/lib/api.ts` to match.

**Conventions**
- Base URL: `NEXT_PUBLIC_API_URL`. JSON in, JSON out. Field names are the ERD column names (snake_case).
- Auth: `Authorization: Bearer <JWT>` on everything except `/auth/*`. A `401` makes the frontend sign the user out.
- Errors: non-2xx with `{ "message": "human readable text" }`. The frontend shows `message` to the user.
- Dates are `YYYY-MM-DD`; timestamps are ISO 8601.

## Auth
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ full_name, email, password }` | `{ token, user }` |
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/auth/google`, `/auth/facebook` | – | Starts OAuth. After success, redirect the browser to the frontend with the token (see open question 1). |
| GET | `/auth/me` | – | `User` |

`User` = the full `users` row **without** `password_hash`.

## Trips and matching
| Method | Path | Notes |
|---|---|---|
| POST | `/trips` | Body: `{ destination, traveling_from, departure_date, return_date, budget_usd, looking_for_count, travel_styles[], interests[] }` → `Trip`. Validate `return_date >= departure_date`, `looking_for_count` 1–4. |
| GET | `/trips/mine/active` | The user's current active trip, or `null`. |
| GET | `/matches` | Query: `destination, from, to, budget_min, budget_max, styles, interests` (comma-separated lists). Returns `MatchedTraveler[]`: other users whose active trip overlaps (`trip_dates &&`), excluding the caller and anyone blocked/already requested. Target < 2 s. |

`MatchedTraveler` = `{ user_id, full_name, age, avatar_url, rating, trips_count, bio, interests[], travel_styles[], destination, departure_date, return_date, budget_usd }`.

## Chat requests and messaging
| Method | Path | Notes |
|---|---|---|
| POST | `/chat-requests` | `{ receiver_id }`. Creates a `pending` request; also create a `notifications` row for the receiver. |
| GET | `/chat-requests` | Incoming requests for the caller. |
| PATCH | `/chat-requests/:id` | `{ status: "accepted" \| "declined" }`. On accept, create the `conversations` row (`user_one_id < user_two_id`). |
| GET | `/conversations` | `Conversation[]`, newest first. Each: `{ conversation_id, other_user: { user_id, full_name, avatar_url, is_online, destination }, last_message_text, last_message_at, unread_count }`. |
| GET | `/conversations/:id/messages` | `DirectMessage[]`, oldest first. 403 if the caller is not a participant. |
| POST | `/conversations/:id/messages` | `{ content }` → `DirectMessage`. Also emits `message:new` over Socket.io. |
| PATCH | `/conversations/:id/read` | Marks the caller's incoming messages read. |

### Socket.io
- Connect with `io(url, { auth: { token } })`; verify the JWT in a handshake middleware.
- Server joins each socket to rooms `user:<id>`, plus `group:<id>` for each group they belong to.
- Server → client: `message:new` (payload: `DirectMessage`), `group:message:new` (payload: group message), `notification:new`.
- Sending goes through the REST `POST` above, so permission checks live in one place.

## Groups
| Method | Path | Notes |
|---|---|---|
| GET | `/groups` | `TripGroup[]` with `members[]` and a computed `is_member` for the caller. |
| POST | `/groups` | `{ destination, start_date, end_date, max_members }`. Creator is added to `group_members` with role `owner`. |
| POST | `/groups/:id/join` | 409 `"Group is full"` when `members >= max_members`. |
| DELETE | `/groups/:id/leave` | – |
| GET / POST | `/groups/:id/messages` | Members only. Needed for the group chat screen (not designed yet). |

## Profile and safety
| Method | Path | Notes |
|---|---|---|
| GET | `/users/:id` | Public profile of another traveler; omit email and contact fields when `hide_contact_info`. |
| PATCH | `/users/me` | Any editable `users` field, e.g. `{ hide_contact_info: true }`. |
| POST | `/reports` | `{ reported_user_id, reason }` → creates a `user_reports` row (`open`). |
| GET | `/notifications` | `AppNotification[]`, newest first. |
| PATCH | `/notifications/:id/read` | – |

## Admin (role = `admin` only)
| Method | Path | Notes |
|---|---|---|
| GET | `/admin/reports` | `UserReport[]` including `reporter_name` and `reported_name`. |
| PATCH | `/admin/reports/:id` | `{ status: "reviewing" \| "resolved" \| "dismissed" }`. |
| PATCH | `/admin/users/:id` | `{ is_active: boolean }` to suspend or restore an account. |

## Gaps between the designs and the ERD (need a decision)
1. **OAuth hand-off.** Google/Facebook buttons send the browser to `/auth/google`. The backend must finish by redirecting to the frontend, e.g. `/login/callback?token=…`. That callback page is not built yet.
2. **Trip interests/styles.** The New Trip form collects them, but `trips` has no such columns. Either add `travel_styles text[]` and `interests text[]` to `trips`, or merge them into the user's profile.
3. **Block a user.** The Profile design lists "Block a user", but there is no blocked-users table. Add one (`blocker_id`, `blocked_id`) and exclude blocked users from `/matches` and chat requests.
4. **Enum values.** `role`, `trip_status`, `request_status`, `report_status` and `auth_provider` are named but their values are not in the ERD. The frontend assumes: `traveler|admin`, `active|completed|cancelled`, `pending|accepted|declined`, `open|reviewing|resolved|dismissed`, `email|google|facebook`.
5. **Budget.** Cards show `$800 / week` in the design but the column is a single `budget_usd` number. The frontend shows it as a plain dollar amount.
6. **Online status.** `is_online` needs to come from socket presence (the ERD only has `last_seen_at`).
