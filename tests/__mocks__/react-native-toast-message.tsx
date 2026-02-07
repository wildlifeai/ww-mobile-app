
import { View } from 'react-native';

const Toast = (props: any) => <View testID="mock-toast" {...props} />;
export default Toast;
export const BaseToast = (props: any) => <View {...props} />;
export const ErrorToast = (props: any) => <View {...props} />;
export const InfoToast = (props: any) => <View {...props} />;
