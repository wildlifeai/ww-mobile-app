/**
 * OrgSwitcher Component
 * Organisation switching UI for WW Admin and multi-org users
 *
 * Features:
 * - Only shows for WW Admin or users with 2+ organisations
 * - Dropdown list of user's organisations
 * - Current organisation highlighted
 * - Confirmation dialog before switching
 * - Loading state during switch
 * - Clears RTK Query cache after switch
 */

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { List, Dialog, Portal, Button, RadioButton, Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { useUserOrganisations } from '../hooks/useUserOrganisations';

export const OrgSwitcher = () => {
  const theme = useTheme();
  const {
    organisations,
    currentOrganisation,
    canSwitchOrganisations,
    switchOrganisation,
    isWWAdmin,
  } = useUserOrganisations();

  const [showDialog, setShowDialog] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Don't render if user can't switch organisations
  if (!canSwitchOrganisations) {
    return null;
  }

  const handleOpenDialog = () => {
    setSelectedOrgId(currentOrganisation?.id || null);
    setShowDialog(true);
    setError('');
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setSelectedOrgId(null);
    setError('');
  };

  const handleConfirmSwitch = async () => {
    if (!selectedOrgId || selectedOrgId === currentOrganisation?.id) {
      handleCloseDialog();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await switchOrganisation(selectedOrgId);
      handleCloseDialog();
    } catch (err) {
      console.error('Failed to switch organisation:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to switch organisation. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Organisation Switcher List Item */}
      <List.Item
        title="Switch Organisation"
        description={currentOrganisation?.name || 'No organisation selected'}
        left={(props) => <List.Icon {...props} icon="swap-horizontal" />}
        right={(props) => <List.Icon {...props} icon="chevron-right" />}
        onPress={handleOpenDialog}
        testID="org-switcher-button"
        accessibilityLabel={`Current organisation: ${currentOrganisation?.name || 'None'}. Tap to switch.`}
      />

      {/* Organisation Selection Dialog */}
      <Portal>
        <Dialog visible={showDialog} onDismiss={handleCloseDialog} testID="org-switcher-dialog">
          <Dialog.Title>Switch Organisation</Dialog.Title>

          <Dialog.ScrollArea style={styles.scrollArea}>
            <RadioButton.Group
              onValueChange={(value) => setSelectedOrgId(value)}
              value={selectedOrgId || ''}
            >
              {organisations.map((org) => (
                <RadioButton.Item
                  key={org.id}
                  label={org.name}
                  value={org.id}
                  status={selectedOrgId === org.id ? 'checked' : 'unchecked'}
                  testID={`org-option-${org.id}`}
                  disabled={isLoading}
                  style={[
                    styles.radioItem,
                    org.id === currentOrganisation?.id && {
                      backgroundColor: theme.colors.primaryContainer,
                    },
                  ]}
                />
              ))}
            </RadioButton.Group>
          </Dialog.ScrollArea>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                {error}
              </Text>
            </View>
          )}

          {/* Warning for WW Admin */}
          {isWWAdmin && selectedOrgId !== currentOrganisation?.id && (
            <View style={styles.warningContainer}>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Switching organisation will reload all project data.
              </Text>
            </View>
          )}

          <Dialog.Actions>
            <Button onPress={handleCloseDialog} disabled={isLoading} testID="org-cancel-button">
              Cancel
            </Button>
            <Button
              onPress={handleConfirmSwitch}
              disabled={
                isLoading ||
                !selectedOrgId ||
                selectedOrgId === currentOrganisation?.id
              }
              mode="contained"
              testID="org-confirm-button"
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.colors.onPrimary} />
              ) : (
                'Switch'
              )}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    maxHeight: 400,
    paddingHorizontal: 0,
  },
  radioItem: {
    paddingVertical: 8,
  },
  errorContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  warningContainer: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    paddingBottom: 16,
  },
});
