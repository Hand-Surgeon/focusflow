// =============================================================================
// FocusFlow Database Types
// TypeScript types for all Supabase database tables and enums
// =============================================================================

// -- Enums --

export type TaskQuadrant = "Q1" | "Q2" | "Q3" | "Q4" | "UNCLASSIFIED";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "ARCHIVED" | "QUEUED" | "DISMISSED";

export type SourceType = "MANUAL" | "CALENDAR" | "EMAIL" | "BRAIN_DUMP";

export type ReminderType = "CHAIN_1H" | "CHAIN_30M" | "CHAIN_10M" | "CHAIN_5M";

// -- Table Types --
// NOTE: Using `type` instead of `interface` is required for Supabase
// generic type resolution. Interfaces lack implicit index signatures
// in TypeScript conditional types, causing Schema to fail the
// `extends GenericSchema` check in @supabase/postgrest-js.

export type User = {
  id: string; // UUID, references auth.users
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: string | null;
  preferences: Record<string, unknown>;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
};

export type Task = {
  id: string; // UUID
  user_id: string; // UUID, references users
  title: string;
  description: string | null;
  quadrant: TaskQuadrant;
  status: TaskStatus;
  energy_cost: number; // 1-5
  due_date: string | null; // ISO 8601 timestamp
  source_type: SourceType;
  source_id: string | null;
  ai_reason: string | null;
  parent_task_id: string | null; // UUID, self-referencing
  position: number;
  completed_at: string | null; // ISO 8601 timestamp
  importance_score: number | null; // 1-10, AI-assigned importance
  nudge_message: string | null; // ADHD-friendly motivation message
  estimated_minutes: number | null; // AI-estimated time to complete
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
};

export type EmailMetadata = {
  id: string; // UUID
  task_id: string; // UUID, references tasks
  sender: string;
  subject: string;
  received_at: string; // ISO 8601 timestamp
};

export type Streak = {
  id: string; // UUID
  user_id: string; // UUID, references users
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null; // ISO 8601 date
};

export type Reminder = {
  id: string; // UUID
  task_id: string; // UUID, references tasks
  remind_at: string; // ISO 8601 timestamp
  type: ReminderType;
  sent: boolean;
};

export type GoogleToken = {
  id: string; // UUID
  user_id: string; // UUID, references auth.users
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null; // ISO 8601 timestamp
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
};

// -- Input Types --

export type TaskCreateInput = Omit<
  Task,
  "id" | "user_id" | "created_at" | "updated_at" | "completed_at"
>;

export type TaskUpdateInput = Partial<TaskCreateInput>;

// -- Supabase Database Type --

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<User, "id">>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at" | "importance_score" | "nudge_message" | "estimated_minutes"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          importance_score?: number | null;
          nudge_message?: string | null;
          estimated_minutes?: number | null;
        };
        Update: Partial<Omit<Task, "id">>;
        Relationships: [];
      };
      email_metadata: {
        Row: EmailMetadata;
        Insert: Omit<EmailMetadata, "id"> & {
          id?: string;
        };
        Update: Partial<Omit<EmailMetadata, "id">>;
        Relationships: [];
      };
      streaks: {
        Row: Streak;
        Insert: Omit<Streak, "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Streak, "id">>;
        Relationships: [];
      };
      reminders: {
        Row: Reminder;
        Insert: Omit<Reminder, "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Reminder, "id">>;
        Relationships: [];
      };
      google_tokens: {
        Row: GoogleToken;
        Insert: Omit<GoogleToken, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<GoogleToken, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      task_quadrant: TaskQuadrant;
      task_status: TaskStatus;
      source_type: SourceType;
      reminder_type: ReminderType;
    };
  };
};
