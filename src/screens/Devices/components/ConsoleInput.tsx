
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ConsoleInputProps {
    inputText: string;
    onInputChange: (text: string) => void;
    onSend: () => void;
    isConnected: boolean;
}

export const ConsoleInput = ({
    inputText,
    onInputChange,
    onSend,
    isConnected,
}: ConsoleInputProps) => {
    const { bottom } = useSafeAreaInsets();
    const isSendDisabled = !inputText.trim() || !isConnected;

    return (
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
            <View style={[styles.inputContainer, { paddingBottom: bottom + 16 }]}>
                <TextInput
                    style={styles.input}
                    value={inputText}
                    onChangeText={onInputChange}
                    placeholder="Enter command..."
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={isConnected}
                />
                <TouchableOpacity
                    style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
                    onPress={onSend}
                    disabled={isSendDisabled}
                >
                    <MaterialCommunityIcons name="send" size={20} color="#FFF" />
                </TouchableOpacity>
            </View>
        </KeyboardStickyView>
    );
};

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#FFF',
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0',
        alignItems: 'center',
    },
    input: {
        flex: 1,
        backgroundColor: '#F5F5F5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 16,
        color: '#333',
        marginRight: 12,
        height: 40,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2196F3',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#BDBDBD',
    },
    iconStyles: {
        width: 20,
        height: 20,
        tintColor: '#FFF'
    }
});
