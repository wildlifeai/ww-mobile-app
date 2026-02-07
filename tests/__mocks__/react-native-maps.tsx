
import { View } from 'react-native';

const MapView = (props: any) => {
  return <View testID="mock-map-view" {...props} />;
};

export default MapView;
export const Marker = (props: any) => <View testID="mock-map-marker" {...props} />;
export const Callout = (props: any) => <View testID="mock-map-callout" {...props} />;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';
