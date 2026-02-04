/**
 * InvitationService - Project invitation management service
 *
 * Internal Mobile App Notification System:
 * - No emails are sent - invitations delivered via app notifications
 * - Email addresses used for user identification/matching only
 * - Realtime subscriptions provide instant notification delivery
 * - Invitations sync to local WatermelonDB for offline access
 */

import { Q } from '@nozbe/watermelondb'
import database from '../database'
import ProjectInvitation from '../database/models/ProjectInvitation'
import { getSupabaseClient } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { log, logError, logWarn } from '../utils/logger'


interface PendingInvitation {
    id: string
    project_id: string
    project_name: string
    inviter_id: string
    inviter_email: string
    role: 'project_admin' | 'project_member'
    created_at: string
    expires_at: string
}

class InvitationService {
    private readonly invitationsCollection = database.collections.get<ProjectInvitation>('project_invitations')
    private realtimeChannel: RealtimeChannel | null = null

    /**
     * Send a project invitation (creates database record, no email sent)
     * Invitee will be notified through the app's internal notification system
     */
    async sendInvitation(
        projectId: string,
        inviteeEmail: string,
        role: 'project_admin' | 'project_member' = 'project_member'
    ): Promise<string> {
        try {
            log('📨 Sending invitation:', { projectId, inviteeEmail, role })

            const supabase = getSupabaseClient()
            const { data, error } = await supabase.rpc('send_project_invitation' as any, {
                p_project_id: projectId,
                p_invitee_email: inviteeEmail,
                p_role: role,
            })

            if (error) throw error

            log('✅ Invitation sent successfully:', data)

            // Trigger sync to update local invitation list
            await this.syncInvitations()

            return data as string // invitation ID
        } catch (error) {
            logError('❌ Failed to send invitation:', error)
            throw error
        }
    }

    /**
     * Check if a user exists by email
     * Used for validation before sending an invitation
     */
    async checkUserExists(email: string): Promise<boolean> {
        try {
            const supabase = getSupabaseClient()
            const { data, error } = await supabase.rpc('check_user_exists' as any, {
                p_email: email
            })

            if (error) throw error

            return !!data
        } catch (error) {
            logError('❌ Failed to check user existence:', error)
            throw error
        }
    }

    /**
     * Get pending invitations for a specific project (for Project Admins)
     */
    async getProjectPendingInvitations(projectId: string): Promise<ProjectInvitation[]> {
        try {
            log('📥 Fetching pending invitations for project:', projectId)

            const supabase = getSupabaseClient()
            const { data, error } = await supabase.rpc('get_project_pending_invitations' as any, {
                p_project_id: projectId
            })

            if (error) throw error

            log(`✅ Found ${data?.length || 0} pending invitations for project`)
            return (data || []) as any[]
        } catch (error) {
            logError('❌ Failed to fetch project pending invitations:', error)
            return []
        }
    }

    /**
     * Get pending invitations for current user from RPC
     */
    async getMyPendingInvitations(): Promise<PendingInvitation[]> {
        try {
            log('📥 Fetching pending invitations...')

            const supabase = getSupabaseClient()
            const { data, error } = await supabase.rpc('get_my_pending_invitations' as any)

            if (error) throw error

            log(`✅ Found ${data?.length || 0} pending invitations`)

            return (data || []) as PendingInvitation[]
        } catch (error) {
            logError('❌ Failed to fetch pending invitations:', error)
            throw error
        }
    }

    /**
     * Get pending invitations from local WatermelonDB
     */
    async getLocalPendingInvitations(): Promise<ProjectInvitation[]> {
        try {
            const invitations = await this.invitationsCollection
                .query(
                    Q.where('status', 'pending'),
                    Q.where('expires_at', Q.gt(Date.now()))
                )
                .fetch()

            log(`✅ Found ${invitations.length} pending invitations in local DB`)

            return invitations
        } catch (error) {
            logError('❌ Failed to fetch local invitations:', error)
            return []
        }
    }

    /**
     * Accept or decline an invitation
     */
    async respondToInvitation(
        invitationId: string,
        accept: boolean
    ): Promise<void> {
        try {
            log(`${accept ? '✅' : '❌'} Responding to invitation:`, invitationId)

            const supabase = getSupabaseClient()
            const { error } = await supabase.rpc('respond_to_invitation' as any, {
                p_invitation_id: invitationId,
                p_accept: accept,
            })

            if (error) throw error

            log('✅ Invitation response recorded')

            // Clean up local invitation
            await this.removeLocalInvitation(invitationId)
        } catch (error) {
            logError('❌ Failed to respond to invitation:', error)
            throw error
        }
    }

    /**
     * Sync invitations from Supabase to local DB
     * This is how notification delivery works - through database sync
     */
    async syncInvitations(): Promise<void> {
        try {
            log('🔄 Syncing invitations from Supabase...')

            const supabase = getSupabaseClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                logWarn('⚠️ No user session, skipping invitation sync.')
                return
            }

            // Use RPC to get invitations (bypasses RLS)
            const { data: remoteInvitations, error } = await supabase.rpc('get_my_pending_invitations' as any)

            if (error) throw error

            log(`📦 Syncing ${remoteInvitations?.length || 0} invitations to local DB`)

            // Sync to local DB
            await database.write(async () => {
                for (const remote of (remoteInvitations || []) as any[]) {
                    const existing = await this.invitationsCollection
                        .query(Q.where('remote_id', remote.id))
                        .fetch()

                    if (existing.length > 0) {
                        // Update existing
                        await existing[0].update(invitation => {
                            invitation.status = 'pending' // RPC only returns pending
                        })
                    } else {
                        // Create new
                        await this.invitationsCollection.create(invitation => {
                            invitation.remoteId = remote.id
                            invitation.projectId = remote.project_id
                            invitation.inviterId = remote.inviter_id
                            invitation.inviteeEmail = user.email || ''
                            invitation.inviteeId = user.id
                            invitation.role = remote.role
                            invitation.status = 'pending'
                            invitation.expiresAt = new Date(remote.expires_at)
                        })
                    }
                }
            })

            log('✅ Invitations synced successfully')
        } catch (error) {
            logError('❌ Failed to sync invitations:', error)
            throw error
        }
    }

    /**
     * Setup realtime subscription for new invitations
     * This enables instant in-app notifications when invitations are received
     */
    subscribeToInvitations(userEmail: string, callback: (payload: any) => void): RealtimeChannel {
        log('🔔 Setting up realtime invitation subscription for:', userEmail)

        const supabase = getSupabaseClient()

        // Unsubscribe from any existing channel
        if (this.realtimeChannel) {
            this.realtimeChannel.unsubscribe()
        }

        this.realtimeChannel = supabase
            .channel('project_invitations')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'project_invitations',
                    filter: `invitee_email=eq.${userEmail}`,
                },
                async (payload) => {
                    log('🔔 New invitation received:', payload)

                    // Sync the new invitation to local DB
                    await this.syncInvitations()

                    // Notify callback
                    callback(payload)
                }
            )
            .subscribe((status) => {
                log('📡 Realtime subscription status:', status)
            })

        return this.realtimeChannel
    }

    /**
     * Unsubscribe from realtime invitations
     */
    unsubscribeFromInvitations(): void {
        if (this.realtimeChannel) {
            log('🔕 Unsubscribing from invitation notifications')
            this.realtimeChannel.unsubscribe()
            this.realtimeChannel = null
        }
    }

    /**
     * Remove invitation from local DB after response
     */
    private async removeLocalInvitation(remoteId: string): Promise<void> {
        try {
            const localInvitations = await this.invitationsCollection
                .query(Q.where('remote_id', remoteId))
                .fetch()

            if (localInvitations.length > 0) {
                await database.write(async () => {
                    await localInvitations[0].markAsDeleted()
                })
                log('✅ Local invitation removed')
            }
        } catch (error) {
            logError('❌ Failed to remove local invitation:', error)
        }
    }

    /**
     * Get invitation count for badge display
     */
    async getPendingInvitationCount(): Promise<number> {
        try {
            const invitations = await this.getLocalPendingInvitations()
            return invitations.length
        } catch (error) {
            logError('❌ Failed to get invitation count:', error)
            return 0
        }
    }
}

export default new InvitationService()
