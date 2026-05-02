export interface UserProfile {
    id: string;
    email: string;
    firstName?: string;
    first_name?: string; // DB column name compatibility
    firstname?: string; // Legacy/Supabase field compatibility
    lastName?: string;
    last_name?: string; // DB column name compatibility
    surname?: string; // Legacy/Supabase field compatibility
    name?: string; // Full name fallback
}

// Interface for member objects returned by RPC/Join operations
export interface MemberWithProfile {
    id?: string;
    user_id?: string; // Sometimes ID is in user_id field
    email?: string;
    
    // Profile fields might be direct properties or nested in a profile object
    firstname?: string; 
    surname?: string;
    first_name?: string;
    last_name?: string;
    name?: string;

    // Nested profile object (common in some queries)
    user_profile?: UserProfile | any; // 'any' for legacy loose typing
    profile?: UserProfile | any;
}
