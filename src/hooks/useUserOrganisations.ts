/**
 * useUserOrganisations Hook
 * Manages user's organisation context and switching
 *
 * Features:
 * - Access to user's organisations
 * - Current organisation tracking
 * - Organisation switching with permission validation
 * - RTK Query cache invalidation on switch
 */

import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../redux';
import {
  selectCurrentUser,
  selectCurrentOrganisation,
  setCurrentOrganisation,
  UserOrganisation,
} from '../redux/slices/authSlice';
import { projectsApi } from '../store/api/projectsApi';

export const useUserOrganisations = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectCurrentUser);
  const currentOrganisation = useAppSelector(selectCurrentOrganisation);

  // Get all organisations the user belongs to
  const organisations = useMemo(
    () => user?.organisations || [],
    [user?.organisations]
  );

  // Check if user can switch organisations (WW Admin or multiple orgs)
  const canSwitchOrganisations = useMemo(
    () => user?.role === 'ww_admin' || (organisations.length > 1),
    [user?.role, organisations.length]
  );

  // Switch to a different organisation
  const switchOrganisation = useCallback(
    async (organisationId: string) => {
      // Validate organisation exists in user's list
      const targetOrg = organisations.find((org) => org.id === organisationId);
      if (!targetOrg) {
        throw new Error('Unauthorised organisation access');
      }

      // Update current organisation in state
      dispatch(setCurrentOrganisation(organisationId));

      // Clear RTK Query cache to refetch data for new organisation
      dispatch(projectsApi.util.resetApiState());

      return targetOrg;
    },
    [dispatch, organisations]
  );

  // Get organisation by ID
  const getOrganisationById = useCallback(
    (organisationId: string): UserOrganisation | undefined => {
      return organisations.find((org) => org.id === organisationId);
    },
    [organisations]
  );

  return {
    organisations,
    currentOrganisation,
    canSwitchOrganisations,
    switchOrganisation,
    getOrganisationById,
    isWWAdmin: user?.role === 'ww_admin',
  };
};
