// Hand-written types matching supabase/migrations/0001_init.sql.
// If the schema changes, update this alongside the migration — or swap it
// for `supabase gen types typescript` output once the project is linked.
//
// Shape (Row/Insert/Update/Relationships per table, Views, Functions) mirrors
// what `supabase gen types typescript` emits — @supabase/postgrest-js's
// GenericSchema constraint requires exactly this, or table types silently
// collapse to `never`.

export type UserRole = "admin" | "board_member";
export type ProjectStatus = "bidding" | "awarded" | "in_progress" | "complete";
export type BidStatus = "submitted" | "awarded" | "rejected";
export type TimelineStatus = "on_track" | "ahead" | "delayed";
export type PollStatus = "open" | "closed";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          org_id: string | null;
          email: string;
          name: string;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          org_id?: string | null;
          email: string;
          name?: string;
          role?: UserRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          org_id: string;
          title: string;
          status: ProjectStatus;
          budget_estimate: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          title?: string;
          status?: ProjectStatus;
          budget_estimate?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["projects"]["Insert"]>;
        Relationships: [];
      };
      line_items: {
        Row: {
          id: string;
          project_id: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          label?: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["line_items"]["Insert"]>;
        Relationships: [];
      };
      bids: {
        Row: {
          id: string;
          project_id: string;
          vendor_name: string;
          vendor_contact: string | null;
          warranty_years: number | null;
          timeline_weeks: number | null;
          notes: string | null;
          status: BidStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          vendor_name?: string;
          vendor_contact?: string | null;
          warranty_years?: number | null;
          timeline_weeks?: number | null;
          notes?: string | null;
          status?: BidStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["bids"]["Insert"]>;
        Relationships: [];
      };
      bid_line_item_amounts: {
        Row: {
          id: string;
          bid_id: string;
          line_item_id: string;
          amount: number | null;
        };
        Insert: {
          id?: string;
          bid_id: string;
          line_item_id: string;
          amount?: number | null;
        };
        Update: Partial<Database["public"]["Tables"]["bid_line_item_amounts"]["Insert"]>;
        Relationships: [];
      };
      board_checkins: {
        Row: {
          id: string;
          project_id: string;
          respond_by: string | null;
          message: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          respond_by?: string | null;
          message?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_checkins"]["Insert"]>;
        Relationships: [];
      };
      checkin_responses: {
        Row: {
          id: string;
          checkin_id: string;
          board_member_id: string | null;
          name: string;
          email: string;
          pick_bid_id: string | null;
          note: string | null;
          token: string;
          responded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          checkin_id: string;
          board_member_id?: string | null;
          name?: string;
          email?: string;
          pick_bid_id?: string | null;
          note?: string | null;
          token?: string;
          responded_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["checkin_responses"]["Insert"]>;
        Relationships: [];
      };
      contractors: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          contact_email: string | null;
          contact_phone: string | null;
          access_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name?: string;
          contact_email?: string | null;
          contact_phone?: string | null;
          access_token?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contractors"]["Insert"]>;
        Relationships: [];
      };
      weekly_updates: {
        Row: {
          id: string;
          project_id: string;
          contractor_id: string;
          week_of: string;
          percent_complete: number;
          timeline_status: TimelineStatus;
          issues_text: string | null;
          next_milestone_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          contractor_id: string;
          week_of?: string;
          percent_complete?: number;
          timeline_status?: TimelineStatus;
          issues_text?: string | null;
          next_milestone_date?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_updates"]["Insert"]>;
        Relationships: [];
      };
      photos: {
        Row: {
          id: string;
          update_id: string;
          url: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          update_id: string;
          url: string;
          caption?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["photos"]["Insert"]>;
        Relationships: [];
      };
      residents: {
        Row: {
          id: string;
          org_id: string;
          unit_label: string;
          contact_email: string | null;
          access_token: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          unit_label?: string;
          contact_email?: string | null;
          access_token?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["residents"]["Insert"]>;
        Relationships: [];
      };
      board_polls: {
        Row: {
          id: string;
          org_id: string;
          question: string;
          description: string | null;
          respond_by: string | null;
          status: PollStatus;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          question?: string;
          description?: string | null;
          respond_by?: string | null;
          status?: PollStatus;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["board_polls"]["Insert"]>;
        Relationships: [];
      };
      poll_options: {
        Row: {
          id: string;
          poll_id: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          poll_id: string;
          label?: string;
          sort_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["poll_options"]["Insert"]>;
        Relationships: [];
      };
      poll_responses: {
        Row: {
          id: string;
          poll_id: string;
          resident_id: string;
          option_id: string | null;
          note: string | null;
          responded_at: string;
        };
        Insert: {
          id?: string;
          poll_id: string;
          resident_id: string;
          option_id?: string | null;
          note?: string | null;
          responded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["poll_responses"]["Insert"]>;
        Relationships: [];
      };
      reserve_settings: {
        Row: {
          org_id: string;
          current_balance: number;
          annual_contribution: number;
          updated_at: string;
        };
        Insert: {
          org_id: string;
          current_balance?: number;
          annual_contribution?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reserve_settings"]["Insert"]>;
        Relationships: [];
      };
      reserve_assets: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          expected_lifespan_years: number;
          replacement_cost: number;
          current_age_years: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name?: string;
          expected_lifespan_years?: number;
          replacement_cost?: number;
          current_age_years?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reserve_assets"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_org_and_admin: {
        Args: { p_org_name: string; p_admin_name: string };
        Returns: string;
      };
      record_checkin_response_by_token: {
        Args: { p_token: string; p_pick_bid_id: string | null; p_note: string | null };
        Returns: undefined;
      };
      record_poll_response_by_token: {
        Args: { p_token: string; p_poll_id: string; p_option_id: string | null; p_note: string | null };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
