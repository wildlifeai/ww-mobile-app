import React, { useMemo } from 'react';
import { Modal, View, Image, StyleSheet, useWindowDimensions, TouchableOpacity } from 'react-native';
import { IconButton, Text, Surface, useTheme as usePaperTheme } from 'react-native-paper';

interface ImagePreviewModalProps {
    visible: boolean;
    imageUri: string | null;
    onDismiss: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
    visible,
    imageUri,
    onDismiss,
}) => {
    const theme = usePaperTheme();
    const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();

    const dynamicStyles = useMemo(() => ({
        content: {
            backgroundColor: theme.colors.surface,
            width: SCREEN_WIDTH * 0.9,
            maxHeight: SCREEN_HEIGHT * 0.8,
        },
        header: {
            backgroundColor: theme.colors.primary
        },
        imageContainer: {
            height: SCREEN_HEIGHT * 0.6,
        },
        filename: {
            color: theme.colors.onSurfaceVariant
        }
    }), [theme, SCREEN_WIDTH, SCREEN_HEIGHT])

    if (!imageUri) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <View style={styles.container}>
                {/* Backdrop */}
                <TouchableOpacity
                    style={styles.backdrop}
                    activeOpacity={1}
                    onPress={onDismiss}
                />

                {/* Content */}
                <Surface style={[styles.content, dynamicStyles.content]}>
                    {/* Header */}
                    <View style={[styles.header, dynamicStyles.header]}>
                        <Text style={styles.title}>Image Preview</Text>
                        <IconButton
                            icon="close"
                            iconColor="#fff"
                            size={24}
                            onPress={onDismiss}
                        />
                    </View>

                    {/* Image */}
                    <View style={[styles.imageContainer, dynamicStyles.imageContainer]}>
                        <Image
                            source={{ uri: imageUri }}
                            style={styles.image}
                            resizeMode="contain"
                        />
                    </View>

                    {/* Footer with filename */}
                    <View style={styles.footer}>
                        <Text style={[styles.filename, dynamicStyles.filename]}>
                            {imageUri.startsWith('data:') ? 'Captured Image' : imageUri.split('/').pop()}
                        </Text>
                    </View>
                </Surface>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    content: {
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: "0px 4px 8px rgba(0, 0, 0, 0.3)",
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 16,
        paddingRight: 4,
        height: 56,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    imageContainer: {
        width: '100%',
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    footer: {
        padding: 16,
        alignItems: 'center',
    },
    filename: {
        fontSize: 14,
        fontStyle: 'italic',
    },
});
