console.log("Sanity setup loaded");

// Setup fake timers
beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
});

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
}));

// Mock NativeModules
import { NativeModules } from "react-native";

// Mock BleManager
NativeModules.BleManager = {
    start: jest.fn(),
    scan: jest.fn(),
    stopScan: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    checkState: jest.fn(),
    startNotification: jest.fn(),
    stopNotification: jest.fn(),
    read: jest.fn(),
    write: jest.fn(),
    writeWithoutResponse: jest.fn(),
    readRSSI: jest.fn(),
    retrieveServices: jest.fn(),
};

// Mock WatermelonDB Bridge
NativeModules.WMDatabaseBridge = {
    initialize: jest.fn(),
    setUp: jest.fn(),
    find: jest.fn(),
    query: jest.fn(),
    count: jest.fn(),
    batch: jest.fn(),
    unsafeResetDatabase: jest.fn(),
    getLocal: jest.fn(),
};

// Mock PlatformConstants
NativeModules.PlatformConstants = {
    forceTouchAvailable: false,
    getConstants: () => ({
        forceTouchAvailable: false,
        reactNativeVersion: { major: 0, minor: 72, patch: 6 },
    }),
};

// Mock React Native Safe Area Context
jest.mock("react-native-safe-area-context", () => ({
    SafeAreaProvider: ({ children }: { children: any }) => children,
    SafeAreaView: ({ children }: { children: any }) => children,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

// Mock React Native Vector Icons
jest.mock("react-native-vector-icons/MaterialIcons", () => "MaterialIcon");
jest.mock("react-native-vector-icons/FontAwesome", () => "FontAwesome");

// Mock Expo File System
jest.mock("expo-file-system", () => ({
    documentDirectory: "/mock/documents/",
    downloadAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    deleteAsync: jest.fn(),
    getInfoAsync: jest.fn(),
    makeDirectoryAsync: jest.fn(),
    copyAsync: jest.fn(),
    moveAsync: jest.fn(),
}));

// Mock Expo Constants
jest.mock("expo-constants", () => ({
    expoConfig: {
        extra: {
            apiBase: "https://test-api.wildlife.com",
        },
    },
}));

// Mock React Navigation (simplified)
jest.mock("@react-navigation/native", () => ({
    NavigationContainer: ({ children }: { children: any }) => children,
    useNavigation: () => ({
        navigate: jest.fn(),
        goBack: jest.fn(),
        addListener: jest.fn(),
        setOptions: jest.fn(),
    }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: jest.fn(),
}));

// Mock React Native Gesture Handler
jest.mock("react-native-gesture-handler", () => ({
    Swipeable: "Swipeable",
    DrawerLayout: "DrawerLayout",
    State: {},
    ScrollView: "ScrollView",
    Slider: "Slider",
    Switch: "Switch",
    TextInput: "TextInput",
    ToolbarAndroid: "ToolbarAndroid",
    ViewPagerAndroid: "ViewPagerAndroid",
    DrawerLayoutAndroid: "DrawerLayoutAndroid",
    WebView: "WebView",
    NativeViewGestureHandler: "NativeViewGestureHandler",
    TapGestureHandler: "TapGestureHandler",
    FlingGestureHandler: "FlingGestureHandler",
    ForceTouchGestureHandler: "ForceTouchGestureHandler",
    LongPressGestureHandler: "LongPressGestureHandler",
    PanGestureHandler: "PanGestureHandler",
    PinchGestureHandler: "PinchGestureHandler",
    RotationGestureHandler: "RotationGestureHandler",
    /* Buttons */
    RawButton: "RawButton",
    BaseButton: "BaseButton",
    RectButton: "RectButton",
    BorderlessButton: "BorderlessButton",
    /* Other */
    FlatList: "FlatList",
    gestureHandlerRootHOC: jest.fn(),
    Directions: {},
}));

// Mock React Native Paper
jest.mock("react-native-paper", () => ({
    Provider: ({ children }: { children: any }) => children,
    PaperProvider: ({ children }: { children: any }) => children,
    Button: ({ children, disabled, ...props }: any) => {
        const React = require("react");
        const { View, Text } = require("react-native");
        return React.createElement(View, {
            ...props,
            accessibilityState: { disabled },
            disabled
        }, React.createElement(Text, null, children));
    },
    Checkbox: Object.assign((props: any) => {
        const React = require("react");
        const { View } = require("react-native");
        const checked = props.status === "checked";
        return React.createElement(View, {
            ...props,
            accessibilityRole: "checkbox",
            accessible: true,
            accessibilityState: { checked }
        });
    }, { Android: "Checkbox.Android", IOS: "Checkbox.IOS", Item: "Checkbox.Item" }),
    Text: "Text",
    TextInput: "TextInput",
    ActivityIndicator: "ActivityIndicator",
    MD3LightTheme: { colors: {} },
    useTheme: () => ({ colors: {} }),
    Menu: Object.assign(({ children }: { children: any }) => children, { Item: "Menu.Item" }),
    RadioButton: Object.assign("RadioButton", { Group: "RadioButton.Group", Item: "RadioButton.Item" }),
    List: Object.assign("List", { Section: "List.Section", Subheader: "List.Subheader", Item: "List.Item", Icon: "List.Icon" }),
    Divider: "Divider",
    Portal: Object.assign(({ children }: { children: any }) => children, { Host: "Portal.Host" }),
    Dialog: Object.assign(({ children }: { children: any }) => children, { Title: "Dialog.Title", Content: "Dialog.Content", Actions: "Dialog.Actions", ScrollArea: "Dialog.ScrollArea" }),
    Paragraph: "Paragraph",
    TouchableRipple: ({ children }: { children: any }) => children,
    Switch: "Switch",
    adaptNavigationTheme: jest.fn(() => ({ LightTheme: {}, DarkTheme: {} })),
}));

// Mock React Native Paper Dropdown
jest.mock("react-native-paper-dropdown", () => ({
    Dropdown: ({ testID, label, value, disabled }: { testID?: string; label?: string; value?: string; disabled?: boolean }) => {
        const React = require("react");
        const { View, Text } = require("react-native");
        return React.createElement(View, {
            testID,
            accessibilityState: { disabled },
            disabled
        },
            React.createElement(Text, null, label || "Dropdown"),
            React.createElement(Text, null, value || "")
        );
    },
}));

// Mock Supabase Service
jest.mock("../../src/services/supabase", () => ({
    getSupabaseClient: jest.fn(() => ({
        auth: {
            getSession: jest.fn(() => Promise.resolve({ data: { session: null }, error: null })),
            onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
        },
    })),
    initializeSupabaseClient: jest.fn(() => Promise.resolve()),
    resetSupabaseClient: jest.fn(),
    onSupabaseClientChange: jest.fn(() => jest.fn()),
    reconnectSupabase: jest.fn(() => Promise.resolve()),
    getCurrentEnvironment: jest.fn(() => null),
}));

// Mock NativeEventEmitter
jest.mock("react-native/Libraries/EventEmitter/NativeEventEmitter");

// Mock NativePlatformConstantsIOS
jest.mock("react-native/Libraries/Utilities/NativePlatformConstantsIOS", () => ({
    getConstants: () => ({
        forceTouchAvailable: false,
        osVersion: "10.0",
        systemName: "iOS",
        reactNativeVersion: { major: 0, minor: 72, patch: 6 },
    }),
}));

// Mock Database to prevent SQLiteAdapter crash
const mockDatabase = {
    collections: {
        get: jest.fn(() => ({
            query: jest.fn(() => ({ fetch: jest.fn(() => []) })),
            create: jest.fn(),
            prepareCreate: jest.fn(),
        })),
    },
    write: jest.fn((cb) => cb()),
    batch: jest.fn(),
}


