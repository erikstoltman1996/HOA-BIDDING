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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
