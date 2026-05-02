import { UserProfile, MemberWithProfile } from "../types/UserProfile";

/**
 * consistently formats a user's display name from various profile shapes
 * Handles nested profile objects, legacy field names, and fallbacks
 */
export const getDisplayName = (userOrMember: UserProfile | MemberWithProfile | any, isMe: boolean = false): string => {
    if (!userOrMember) return "Unknown User";

    const profile = userOrMember.user_profile || userOrMember.profile || userOrMember;
    
    const firstName = profile.firstName || profile.first_name || profile.firstname || "";
    const lastName = profile.lastName || profile.last_name || profile.surname || "";
    const email = profile.email || userOrMember.email || "";
    
    // Prefer explicitly set full name if available and not "Unknown"
    const explicitName = profile.name;
    
    let displayName = "";

    if (firstName || lastName) {
        displayName = `${firstName} ${lastName}`.trim();
    } else if (explicitName && explicitName !== "Unknown" && explicitName !== "Unknown User") {
        displayName = explicitName;
    } else if (email) {
        displayName = email;
    } else {
        displayName = "Unknown User";
    }

    if (isMe) {
        return displayName === "Unknown User" ? "Me (You)" : `${displayName} (You)`;
    }

    return displayName;
};
