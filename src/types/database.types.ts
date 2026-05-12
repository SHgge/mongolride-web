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

// EP-06 notification types
export type NotificationCategory =
  | 'transactional' | 'event_lifecycle' | 'weather' | 'social' | 'marketing' | 'system';
export type NotificationChannel = 'email' | 'in_app' | 'web_push';
export type NotificationLocale = 'mn' | 'en';
export type NotificationOutboxStatus =
  | 'queued' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'dead' | 'suppressed';

export interface NotificationTemplateVariable {
  name: string;
  type: 'string' | 'number' | 'url' | 'date' | 'boolean';
  required?: boolean;
  example?: string | number | boolean;
}

export interface NotificationMatrix {
  transactional?:   { email?: boolean; in_app?: boolean; web_push?: boolean };
  event_lifecycle?: { email?: boolean; in_app?: boolean; web_push?: boolean };
  weather?:         { email?: boolean; in_app?: boolean; web_push?: boolean };
  social?:          { email?: boolean; in_app?: boolean; web_push?: boolean };
  marketing?:       { email?: boolean; in_app?: boolean; web_push?: boolean };
  system?:          { email?: boolean; in_app?: boolean; web_push?: boolean };
}

// EP-05 weather types
export type WeatherProvider = 'open-meteo' | 'iqair' | 'aqicn' | 'cached';
export type WeatherRiskLevel = 'green' | 'yellow' | 'orange' | 'red' | 'black';
export type WeatherAlertType =
  | 'cold' | 'heat' | 'wind' | 'aqi' | 'dust'
  | 'rain' | 'snow' | 'thunderstorm' | 'uv' | 'reroute_suggested';
export type WeatherAlertSeverity =
  | 'info' | 'warning' | 'severe' | 'hazardous' | 'cancel_recommended';
export type WeatherForecastWindow =
  | 't_minus_72h' | 't_minus_24h' | 't_minus_6h' | 't_minus_2h' | 'live';

export interface WeatherSnapshot {
  id?: string;
  lat_grid: number;
  lng_grid: number;
  hour_bucket: string;
  provider: WeatherProvider;
  fetched_at: string;
  is_stale: boolean;
  temp_c: number | null;
  feels_like_c: number | null;
  wind_speed_ms: number | null;
  wind_dir_deg: number | null;
  wind_gust_ms: number | null;
  precip_prob_pct: number | null;
  precip_amount_mm: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  cloud_cover_pct: number | null;
  visibility_km: number | null;
  aqi_us: number | null;
  pm25_ugm3: number | null;
  pm10_ugm3: number | null;
  o3_ugm3: number | null;
  no2_ugm3: number | null;
  uv_index: number | null;
  thunderstorm_prob_pct: number | null;
  sunrise_at: string | null;
  sunset_at: string | null;
  cache_hit?: boolean;
}

export interface WeatherRiskComponents {
  cold?: WeatherRiskLevel;
  heat?: WeatherRiskLevel;
  wind?: WeatherRiskLevel;
  aqi?: WeatherRiskLevel;
  dust?: WeatherRiskLevel;
  precip?: WeatherRiskLevel;
  thunderstorm?: WeatherRiskLevel;
  uv?: WeatherRiskLevel;
}

export interface WeatherRisk {
  overall: WeatherRiskLevel;
  components: WeatherRiskComponents;
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
      weather_snapshots: {
        Row: {
          id: string;
          lat_grid: number;
          lng_grid: number;
          hour_bucket: string;
          provider: WeatherProvider;
          fetched_at: string;
          is_stale: boolean;
          temp_c: number | null;
          feels_like_c: number | null;
          wind_speed_ms: number | null;
          wind_dir_deg: number | null;
          wind_gust_ms: number | null;
          precip_prob_pct: number | null;
          precip_amount_mm: number | null;
          humidity_pct: number | null;
          pressure_hpa: number | null;
          cloud_cover_pct: number | null;
          visibility_km: number | null;
          aqi_us: number | null;
          pm25_ugm3: number | null;
          pm10_ugm3: number | null;
          o3_ugm3: number | null;
          no2_ugm3: number | null;
          uv_index: number | null;
          thunderstorm_prob_pct: number | null;
          sunrise_at: string | null;
          sunset_at: string | null;
          raw_payload: Json | null;
        };
        Insert: Partial<Database['public']['Tables']['weather_snapshots']['Row']> & {
          lat_grid: number;
          lng_grid: number;
          hour_bucket: string;
          provider: WeatherProvider;
        };
        Update: Partial<Database['public']['Tables']['weather_snapshots']['Row']>;
        Relationships: [];
      };
      event_alerts: {
        Row: {
          id: string;
          event_id: string;
          alert_type: WeatherAlertType;
          severity: WeatherAlertSeverity;
          triggered_at: string;
          forecast_window: WeatherForecastWindow;
          values_snapshot: Record<string, number | null>;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          acknowledgment_note: string | null;
          resolved_at: string | null;
        };
        Insert: {
          event_id: string;
          alert_type: WeatherAlertType;
          severity: WeatherAlertSeverity;
          forecast_window: WeatherForecastWindow;
          values_snapshot: Record<string, number | null>;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          acknowledgment_note?: string | null;
          resolved_at?: string | null;
        };
        Relationships: [];
      };
      profile_weather_prefs: {
        Row: {
          user_id: string;
          notifications_enabled: boolean;
          cold_threshold_c: number;
          wind_threshold_ms: number;
          aqi_threshold: number;
          notify_on_yellow: boolean;
          notify_on_orange: boolean;
          notify_on_red: boolean;
          notify_on_black: boolean;
          preferred_notification_channels: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string } & Partial<Database['public']['Tables']['profile_weather_prefs']['Row']>;
        Update: Partial<Database['public']['Tables']['profile_weather_prefs']['Row']>;
        Relationships: [];
      };
      notification_templates: {
        Row: {
          id: string;
          key: string;
          locale: NotificationLocale;
          channel: NotificationChannel;
          category: NotificationCategory;
          version: number;
          is_active: boolean;
          subject_md: string | null;
          body_md: string;
          plaintext_md: string | null;
          variables: NotificationTemplateVariable[];
          description: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          locale: NotificationLocale;
          channel: NotificationChannel;
          category: NotificationCategory;
          body_md: string;
          version?: number;
          is_active?: boolean;
          subject_md?: string | null;
          plaintext_md?: string | null;
          variables?: NotificationTemplateVariable[];
          description?: string | null;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['notification_templates']['Insert']>;
        Relationships: [];
      };
      notification_outbox: {
        Row: {
          id: string;
          idempotency_key: string;
          template_key: string;
          category: NotificationCategory;
          channel: NotificationChannel;
          recipient_user_id: string | null;
          recipient_email: string | null;
          recipient_locale: NotificationLocale;
          variables: Record<string, unknown>;
          severity: 'normal' | 'high' | 'severe';
          bypass_dnd: boolean;
          status: NotificationOutboxStatus;
          scheduled_for: string;
          attempted_at: string | null;
          sent_at: string | null;
          retry_count: number;
          last_error: string | null;
          provider_message_id: string | null;
          source_epic: string | null;
          source_event: string | null;
          source_target_id: string | null;
          created_at: string;
        };
        Insert: never; // service-role only
        Update: never;
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          preferred_locale: NotificationLocale;
          timezone: string;
          quiet_hours_start: string | null;
          quiet_hours_end: string | null;
          allow_severe_during_dnd: boolean;
          paused_until: string | null;
          matrix: NotificationMatrix;
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string } & Partial<Database['public']['Tables']['notification_preferences']['Row']>;
        Update: Partial<Database['public']['Tables']['notification_preferences']['Row']>;
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
          checked_in_method: 'qr' | 'manual' | 'self' | 'wallet' | null;
          checked_in_by: string | null;
          checked_in_late: boolean | null;
          checked_in_override: boolean;
          checked_in_lat: number | null;
          checked_in_lng: number | null;
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
