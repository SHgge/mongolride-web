export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = 'member' | 'admin';
export type UserRank = 'unaga' | 'daagan' | 'shudlen' | 'khuleg' | 'avarga';
export type SurfaceType = 'asphalt' | 'gravel' | 'dirt';
export type RouteStatus = 'draft' | 'published' | 'archived';
export type RouteVisibility = 'public' | 'members' | 'private';
export type RouteDifficultyLabel = 'easy' | 'moderate' | 'hard' | 'expert';
export type RouteLoopType = 'loop' | 'out_and_back' | 'point_to_point';
export type RouteDiscipline = 'road' | 'mtb' | 'gravel' | 'urban' | 'commute' | 'bikepacking' | 'training' | 'other';

export interface RouteClimb {
  start_km: number;
  end_km: number;
  length_km: number;
  gain_m: number;
  avg_grade: number;
  max_grade: number;
  category: 'HC' | '1' | '2' | '3' | '4';
}

export interface RouteSurfaceBreakdown {
  asphalt?: number;
  gravel?: number;
  dirt?: number;
}

export interface ElevationPoint {
  km: number;
  ele: number;
}

export type CueType =
  | 'start'
  | 'end'
  | 'left'
  | 'right'
  | 'sharp_left'
  | 'sharp_right'
  | 'slight_left'
  | 'slight_right'
  | 'u_turn';

export interface CueEntry {
  km: number;
  type: CueType;
  segment_distance_m: number;
  bearing_change: number;
}
export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
export type ListingCategory = 'bike' | 'parts' | 'clothing' | 'accessories' | 'other';
export type ListingCondition = 'new' | 'like_new' | 'used' | 'for_parts';
export type ListingStatus = 'active' | 'sold' | 'reserved' | 'removed';
export type SOSStatus = 'active' | 'responding' | 'resolved' | 'false_alarm';
export type NotificationType = 'event' | 'sos' | 'marketplace' | 'route' | 'system' | 'achievement';
export type NewsCategory = 'general' | 'tips' | 'gear_review' | 'race' | 'announcement';
export type BadgeRequirement = 'km' | 'rides' | 'route' | 'event' | 'special';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          role: UserRole;
          rank: UserRank;
          total_km: number;
          total_rides: number;
          total_elevation: number;
          bio: string | null;
          strava_id: string | null;
          last_known_lat: number | null;
          last_known_lng: number | null;
          last_location_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          rank?: UserRank;
          total_km?: number;
          total_rides?: number;
          total_elevation?: number;
          bio?: string | null;
          strava_id?: string | null;
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          last_location_at?: string | null;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          role?: UserRole;
          rank?: UserRank;
          total_km?: number;
          total_rides?: number;
          total_elevation?: number;
          bio?: string | null;
          strava_id?: string | null;
          last_known_lat?: number | null;
          last_known_lng?: number | null;
          last_location_at?: string | null;
          is_active?: boolean;
        };
        Relationships: [];
      };
      routes: {
        Row: {
          id: string;
          title: string;
          description: string;
          // PostGIS — string representation in SELECT (we hydrate via RPCs for geometry)
          path: unknown;
          start_point: unknown | null;
          end_point: unknown | null;
          bbox_geog: unknown | null;
          distance_km: number;
          elevation_gain_m: number;
          elevation_loss_m: number;
          max_elevation_m: number | null;
          min_elevation_m: number | null;
          avg_grade_pct: number | null;
          max_grade_pct: number | null;
          climbs: RouteClimb[];
          elevation_profile: ElevationPoint[];
          cue_sheet: CueEntry[];
          surface_breakdown: RouteSurfaceBreakdown;
          surface_classified_at: string | null;
          difficulty_score: number | null;
          difficulty_label: RouteDifficultyLabel | null;
          discipline: RouteDiscipline;
          loop_type: RouteLoopType | null;
          gpx_path: string | null;
          cleaned_gpx_path: string | null;
          cover_photo_path: string | null;
          region: string | null;
          country: string;
          visibility: RouteVisibility;
          status: RouteStatus;
          created_by: string;
          completion_count: number;
          photo_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          path: string;
          distance_km: number;
          discipline: RouteDiscipline;
          created_by: string;
          description?: string;
          elevation_gain_m?: number;
          elevation_loss_m?: number;
          max_elevation_m?: number | null;
          min_elevation_m?: number | null;
          avg_grade_pct?: number | null;
          max_grade_pct?: number | null;
          climbs?: RouteClimb[];
          elevation_profile?: ElevationPoint[];
          cue_sheet?: CueEntry[];
          surface_breakdown?: RouteSurfaceBreakdown;
          difficulty_score?: number | null;
          difficulty_label?: RouteDifficultyLabel | null;
          loop_type?: RouteLoopType | null;
          gpx_path?: string | null;
          cleaned_gpx_path?: string | null;
          cover_photo_path?: string | null;
          region?: string | null;
          country?: string;
          visibility?: RouteVisibility;
          status?: RouteStatus;
        };
        Update: Partial<Database['public']['Tables']['routes']['Insert']> & {
          status?: RouteStatus;
          surface_classified_at?: string | null;
          completion_count?: number;
          photo_count?: number;
        };
        Relationships: [];
      };
      route_completions: {
        Row: {
          id: string;
          route_id: string;
          user_id: string;
          event_id: string | null;
          ridden_at: string;
          duration_seconds: number | null;
          avg_speed_kmh: number | null;
          notes: string | null;
          rating: number | null;
          ride_gpx_path: string | null;
          created_at: string;
        };
        Insert: {
          route_id: string;
          user_id: string;
          ridden_at: string;
          event_id?: string | null;
          duration_seconds?: number | null;
          avg_speed_kmh?: number | null;
          notes?: string | null;
          rating?: number | null;
          ride_gpx_path?: string | null;
        };
        Update: Partial<Database['public']['Tables']['route_completions']['Insert']>;
        Relationships: [];
      };
      route_photos: {
        Row: {
          id: string;
          route_id: string;
          uploaded_by: string;
          photo_path: string;
          caption: string | null;
          km_marker: number | null;
          taken_at: string | null;
          created_at: string;
        };
        Insert: {
          route_id: string;
          uploaded_by: string;
          photo_path: string;
          caption?: string | null;
          km_marker?: number | null;
          taken_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['route_photos']['Insert']>;
        Relationships: [];
      };
      event_routes: {
        Row: {
          id: string;
          event_id: string;
          route_id: string;
          is_primary: boolean;
          display_order: number;
          label: string | null;
          created_at: string;
        };
        Insert: {
          event_id: string;
          route_id: string;
          is_primary?: boolean;
          display_order?: number;
          label?: string | null;
        };
        Update: Partial<Database['public']['Tables']['event_routes']['Insert']>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          series_id: string | null;
          series_instance_index: number | null;
          title: string;
          description: string;
          cover_photo_path: string | null;
          discipline: 'road' | 'mtb' | 'gravel' | 'urban' | 'commute' | 'bikepacking' | 'training' | 'other';
          skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all';
          effort_zone: 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'mixed' | null;
          pace_min_kmh: number | null;
          pace_max_kmh: number | null;
          drop_policy: 'drop' | 'no_drop' | 'regroup';
          meet_at: string;
          roll_out_at: string;
          end_at: string | null;
          meet_location_name: string;
          meet_lat: number | null;
          meet_lng: number | null;
          distance_km: number | null;
          elevation_gain_m: number | null;
          surface_asphalt_pct: number | null;
          surface_gravel_pct: number | null;
          surface_dirt_pct: number | null;
          required_gear: string[];
          has_sag: boolean;
          has_mechanical_support: boolean;
          capacity: number | null;
          allow_guests: boolean;
          max_guests_per_member: number;
          cancellation_deadline_hours: number;
          fee_amount: number;
          visibility: 'public' | 'members' | 'invitation';
          status: 'draft' | 'published' | 'cancelled' | 'completed';
          cancellation_reason: string | null;
          organizer_id: string;
          co_organizer_ids: string[];
          sweep_rider_id: string | null;
          route_id: string | null;
          buddy_pairing_enabled: boolean;
          live_tracking_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          discipline: 'road' | 'mtb' | 'gravel' | 'urban' | 'commute' | 'bikepacking' | 'training' | 'other';
          skill_level: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'all';
          meet_at: string;
          roll_out_at: string;
          meet_location_name: string;
          organizer_id: string;
          description?: string;
          cover_photo_path?: string | null;
          effort_zone?: string | null;
          pace_min_kmh?: number | null;
          pace_max_kmh?: number | null;
          drop_policy?: string;
          end_at?: string | null;
          meet_lat?: number | null;
          meet_lng?: number | null;
          distance_km?: number | null;
          elevation_gain_m?: number | null;
          surface_asphalt_pct?: number | null;
          surface_gravel_pct?: number | null;
          surface_dirt_pct?: number | null;
          required_gear?: string[];
          has_sag?: boolean;
          has_mechanical_support?: boolean;
          capacity?: number | null;
          allow_guests?: boolean;
          max_guests_per_member?: number;
          cancellation_deadline_hours?: number;
          fee_amount?: number;
          visibility?: string;
          status?: string;
          co_organizer_ids?: string[];
          sweep_rider_id?: string | null;
          route_id?: string | null;
          buddy_pairing_enabled?: boolean;
          live_tracking_enabled?: boolean;
        };
        Update: Partial<Database['public']['Tables']['events']['Insert']> & {
          status?: string;
          cancellation_reason?: string | null;
        };
        Relationships: [];
      };
      event_rsvps: {
        Row: {
          id: string;
          event_id: string;
          user_id: string;
          status: 'confirmed' | 'waitlist' | 'cancelled' | 'pending_payment' | 'no_show' | 'attended';
          waitlist_position: number | null;
          guest_count: number;
          liability_accepted_at: string | null;
          gear_confirmed_at: string | null;
          emergency_contact_name: string | null;
          emergency_contact_phone: string | null;
          notes: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          checked_in_at: string | null;
          check_in_token: string;
          selected_route_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          event_id: string;
          user_id: string;
          status: string;
          selected_route_id?: string | null;
        };
        Update: {
          status?: string;
          checked_in_at?: string | null;
          notes?: string | null;
          selected_route_id?: string | null;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          price: number;
          category: ListingCategory;
          condition: ListingCondition;
          images: string[];
          status: ListingStatus;
          view_count: number;
          seller_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          price: number;
          category: ListingCategory;
          condition: ListingCondition;
          seller_id: string;
          description?: string | null;
          images?: string[];
          status?: ListingStatus;
        };
        Update: {
          title?: string;
          price?: number;
          category?: ListingCategory;
          condition?: ListingCondition;
          seller_id?: string;
          description?: string | null;
          images?: string[];
          status?: ListingStatus;
          view_count?: number;
        };
        Relationships: [];
      };
      group_buys: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          product_url: string | null;
          target_quantity: number;
          current_quantity: number;
          price_per_unit: number;
          deadline: string;
          status: string;
          organizer_id: string;
          created_at: string;
        };
        Insert: {
          title: string;
          target_quantity: number;
          price_per_unit: number;
          deadline: string;
          organizer_id: string;
          description?: string | null;
          product_url?: string | null;
          status?: string;
        };
        Update: {
          title?: string;
          target_quantity?: number;
          price_per_unit?: number;
          deadline?: string;
          description?: string | null;
          product_url?: string | null;
          status?: string;
          current_quantity?: number;
        };
        Relationships: [];
      };
      group_buy_participants: {
        Row: {
          id: string;
          group_buy_id: string;
          user_id: string;
          quantity: number;
          joined_at: string;
        };
        Insert: {
          group_buy_id: string;
          user_id: string;
          quantity?: number;
        };
        Update: {
          group_buy_id?: string;
          user_id?: string;
          quantity?: number;
        };
        Relationships: [];
      };
      sos_alerts: {
        Row: {
          id: string;
          user_id: string;
          location: string;
          message: string | null;
          status: SOSStatus;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          location: string;
          message?: string | null;
          status?: SOSStatus;
        };
        Update: {
          user_id?: string;
          location?: string;
          message?: string | null;
          status?: SOSStatus;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      sos_responses: {
        Row: {
          id: string;
          sos_id: string;
          responder_id: string;
          message: string | null;
          responder_location: string | null;
          responded_at: string;
        };
        Insert: {
          sos_id: string;
          responder_id: string;
          message?: string | null;
          responder_location?: string | null;
        };
        Update: {
          sos_id?: string;
          responder_id?: string;
          message?: string | null;
          responder_location?: string | null;
        };
        Relationships: [];
      };
      news: {
        Row: {
          id: string;
          title: string;
          slug: string;
          content: string;
          excerpt: string | null;
          cover_image: string | null;
          category: NewsCategory;
          is_published: boolean;
          published_at: string | null;
          view_count: number;
          author_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          slug: string;
          content: string;
          excerpt?: string | null;
          cover_image?: string | null;
          category?: NewsCategory;
          is_published?: boolean;
          published_at?: string | null;
          author_id?: string | null;
        };
        Update: {
          title?: string;
          slug?: string;
          content?: string;
          excerpt?: string | null;
          cover_image?: string | null;
          category?: NewsCategory;
          is_published?: boolean;
          published_at?: string | null;
          author_id?: string | null;
          view_count?: number;
        };
        Relationships: [];
      };
      news_comments: {
        Row: {
          id: string;
          news_id: string;
          user_id: string;
          content: string;
          created_at: string;
        };
        Insert: {
          news_id: string;
          user_id: string;
          content: string;
        };
        Update: {
          news_id?: string;
          user_id?: string;
          content?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          message: string | null;
          link: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          type: NotificationType;
          title: string;
          message?: string | null;
          link?: string | null;
          is_read?: boolean;
        };
        Update: {
          user_id?: string;
          type?: NotificationType;
          title?: string;
          message?: string | null;
          link?: string | null;
          is_read?: boolean;
        };
        Relationships: [];
      };
      km_logs: {
        Row: {
          id: string;
          user_id: string;
          distance_km: number;
          elevation_gain: number;
          route_id: string | null;
          ride_date: string;
          strava_activity_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          distance_km: number;
          elevation_gain?: number;
          route_id?: string | null;
          ride_date?: string;
          strava_activity_id?: string | null;
          notes?: string | null;
        };
        Update: {
          user_id?: string;
          distance_km?: number;
          elevation_gain?: number;
          route_id?: string | null;
          ride_date?: string;
          strava_activity_id?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      badges: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon_url: string | null;
          requirement_type: BadgeRequirement;
          requirement_value: number | null;
          requirement_route_id: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          requirement_type: BadgeRequirement;
          description?: string | null;
          icon_url?: string | null;
          requirement_value?: number | null;
          requirement_route_id?: string | null;
        };
        Update: {
          name?: string;
          requirement_type?: BadgeRequirement;
          description?: string | null;
          icon_url?: string | null;
          requirement_value?: number | null;
          requirement_route_id?: string | null;
        };
        Relationships: [];
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_id: string;
          earned_at: string;
        };
        Insert: {
          user_id: string;
          badge_id: string;
        };
        Update: {
          user_id?: string;
          badge_id?: string;
        };
        Relationships: [];
      };
      site_stats: {
        Row: {
          id: string;
          total_members: number;
          total_km: number;
          total_rides: number;
          total_routes: number;
          monthly_km: number;
          monthly_rides: number;
          green_co2_saved_kg: number;
          calculated_at: string;
        };
        Insert: {
          total_members?: number;
          total_km?: number;
          total_rides?: number;
          total_routes?: number;
          monthly_km?: number;
          monthly_rides?: number;
          green_co2_saved_kg?: number;
          calculated_at?: string;
        };
        Update: {
          total_members?: number;
          total_km?: number;
          total_rides?: number;
          total_routes?: number;
          monthly_km?: number;
          monthly_rides?: number;
          green_co2_saved_kg?: number;
          calculated_at?: string;
        };
        Relationships: [];
      };
      club_settings: {
        Row: {
          id: number;
          name: string;
          description: string | null;
          logo_path: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          facebook_url: string | null;
          instagram_url: string | null;
          website_url: string | null;
          rejection_cooldown_days: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          name: string;
          description?: string | null;
          logo_path?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          facebook_url?: string | null;
          instagram_url?: string | null;
          website_url?: string | null;
          rejection_cooldown_days?: number;
        };
        Update: {
          name?: string;
          description?: string | null;
          logo_path?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          facebook_url?: string | null;
          instagram_url?: string | null;
          website_url?: string | null;
          rejection_cooldown_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      monthly_leaderboard: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          rank: UserRank;
          monthly_km: number;
          monthly_rides: number;
          monthly_elevation: number;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
  };
}

// Helper types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
