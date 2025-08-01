import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Button, TextInput, Text, Card } from 'react-native-paper';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { checkSupabaseConnection } from '../services/supabase';

/**
 * Supabase Authentication Test Component
 * 
 * This component provides a simple UI to test Supabase authentication functionality
 * including connection testing, login, registration, and logout.
 */
export const SupabaseAuthTest: React.FC = () => {
  const {
    user,
    token,
    loading,
    isLoggedIn,
    login,
    register,
    logout,
    checkAuthStatus,
  } = useSupabaseAuth();

  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('testpassword123');
  const [username, setUsername] = useState('testuser');
  const [connectionStatus, setConnectionStatus] = useState<string>('Not tested');

  const handleTestConnection = async () => {
    try {
      setConnectionStatus('Testing...');
      const isConnected = await checkSupabaseConnection();
      setConnectionStatus(isConnected ? 'Connected ✅' : 'Failed ❌');
    } catch (error) {
      setConnectionStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleLogin = async () => {
    try {
      await login({
        identifier: email,
        password: password,
      });
      Alert.alert('Success', 'Logged in successfully!');
    } catch (error) {
      Alert.alert('Login Error', error instanceof Error ? error.message : 'Login failed');
    }
  };

  const handleRegister = async () => {
    try {
      await register({
        username: username,
        email: email,
        password: password,
      });
      Alert.alert('Success', 'Registered successfully!');
    } catch (error) {
      Alert.alert('Registration Error', error instanceof Error ? error.message : 'Registration failed');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      Alert.alert('Success', 'Logged out successfully!');
    } catch (error) {
      Alert.alert('Logout Error', error instanceof Error ? error.message : 'Logout failed');
    }
  };

  const handleCheckAuthStatus = async () => {
    try {
      const isAuth = await checkAuthStatus();
      Alert.alert('Auth Status', `Authenticated: ${isAuth ? 'Yes' : 'No'}`);
    } catch (error) {
      Alert.alert('Auth Check Error', error instanceof Error ? error.message : 'Check failed');
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text variant="headlineMedium" style={{ marginBottom: 20 }}>
        Supabase Auth Test
      </Text>

      {/* Connection Test */}
      <Card style={{ marginBottom: 16 }}>
        <Card.Title title="Connection Test" />
        <Card.Content>
          <Text>Status: {connectionStatus}</Text>
          <Button mode="outlined" onPress={handleTestConnection} style={{ marginTop: 8 }}>
            Test Connection
          </Button>
        </Card.Content>
      </Card>

      {/* Auth Status */}
      <Card style={{ marginBottom: 16 }}>
        <Card.Title title="Auth Status" />
        <Card.Content>
          <Text>Logged In: {isLoggedIn ? 'Yes' : 'No'}</Text>
          <Text>User: {user?.email || 'None'}</Text>
          <Text>Token: {token ? 'Present' : 'None'}</Text>
          <Text>Loading: {loading ? 'Yes' : 'No'}</Text>
          <Button mode="outlined" onPress={handleCheckAuthStatus} style={{ marginTop: 8 }}>
            Check Auth Status
          </Button>
        </Card.Content>
      </Card>

      {/* Login/Register Form */}
      {!isLoggedIn && (
        <Card style={{ marginBottom: 16 }}>
          <Card.Title title="Authentication" />
          <Card.Content>
            <TextInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              style={{ marginBottom: 8 }}
            />
            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              style={{ marginBottom: 8 }}
            />
            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ marginBottom: 16 }}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button mode="contained" onPress={handleLogin} style={{ flex: 1 }}>
                Login
              </Button>
              <Button mode="outlined" onPress={handleRegister} style={{ flex: 1 }}>
                Register
              </Button>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* Logout */}
      {isLoggedIn && (
        <Card>
          <Card.Title title="Logged In" />
          <Card.Content>
            <Text>Welcome, {user?.email}!</Text>
            <Button mode="contained" onPress={handleLogout} style={{ marginTop: 8 }}>
              Logout
            </Button>
          </Card.Content>
        </Card>
      )}
    </View>
  );
};