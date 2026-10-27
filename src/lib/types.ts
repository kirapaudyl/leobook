export type OrgType = 'ngo' | 'collective' | 'organizer' | 'health'
export interface Author { id: string; full_name: string | null; username: string | null; avatar_url: string | null }
export interface OrgLite {
  id: string; slug: string; name: string; type: OrgType
  verified: boolean; ai_verified: boolean; logo_url: string | null
}
export interface MediaItem { url: string; type: 'image' | 'video'; credit?: string }

export interface FeedPost {
  id: string
  body: string
  media: MediaItem[]
  location_text: string | null
  is_initiative: boolean
  like_count: number
  comment_count: number
  join_count: number
  share_count: number
  created_at: string
  author: Author
  org: OrgLite | null
  event: { id: string; title: string; starts_at: string; location: string | null } | null
  liked: boolean
  joined: boolean
}

export interface EmergencyCard {
  matchId: string
  response: 'accepted' | 'declined' | null
  bloodGroup: string
  hospital: string
  postedAt: string
  neededBy: string | null
  distanceKm: number | null
  orgName: string | null
  note: string | null
  contactPhone: string | null
}

export interface Opportunity {
  id: string; title: string; cause: string | null; cover_url: string | null
  starts_at: string; location: string | null; distance_km: number | null
  attendee_count: number; attendees: string[]
}

export interface LeaderRow { rank: number; user_id: string; full_name: string | null; points: number; is_me: boolean }

export interface Viewer {
  id: string
  fullName: string
  firstName: string
  initials: string
  skills: string[]
  lat: number | null
  lng: number | null
  location: string
  points: number
  /** What's still missing from the profile, or null when it's complete (drives the sidebar prompt). */
  profileGap: string | null
}
