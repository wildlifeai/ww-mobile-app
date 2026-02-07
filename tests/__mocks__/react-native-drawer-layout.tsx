import React from 'react';
import { View } from 'react-native';

export const Drawer = ({ 
  children 
}: { 
  children: React.ReactNode; 
}) => {
  return (
    <View testID="mock-drawer">
      {children}
    </View>
  );
};
