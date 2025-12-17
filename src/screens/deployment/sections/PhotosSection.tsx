import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Card } from 'react-native-paper'

export const PhotosSection = () => {
    return (
        <Card style={styles.card}>
            <Card.Title title="Deployment Photos" />
            <Card.Content>
                <Text>Photo Upload Placeholder</Text>
            </Card.Content>
        </Card>
    )
}

const styles = StyleSheet.create({
    card: { marginBottom: 16 }
})
