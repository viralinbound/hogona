import { InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { Image, Platform, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '../components/Logo';
import { TextAction } from '../components/ui';
import { FONTS, lightTheme } from '../constants/theme';
import { useT } from '../i18n';
import { AppStateProvider } from '../state/AppState';

function ThemedApp() {
  // The app is light-only by design: one calm, readable look everywhere.
  const theme = lightTheme;
  const tr = useT();
  const insets = useSafeAreaInsets();

  return (
    <PaperProvider theme={theme}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.ink.paper },
          headerShadowVisible: false,
          headerTintColor: theme.ink.ink,
          headerTitleStyle: { fontFamily: FONTS.sansSemi, fontSize: 16 },
          // Text "Back" instead of an arrow icon, matching the icon-free design.
          headerLeft: ({ canGoBack }) =>
            canGoBack ? (
              <View style={{ marginLeft: Platform.OS === 'ios' ? 0 : 16, marginRight: 14 }}>
                <TextAction label="Back" onPress={() => router.back()} />
              </View>
            ) : null,
          headerRight: () => (
            <View style={{ marginRight: Platform.OS === 'ios' ? 0 : 16 }}>
              <Logo variant="mark" size={28} />
            </View>
          ),
          // Side insets cover landscape notches and the status area some foldables reserve on one edge.
          contentStyle: { backgroundColor: theme.ink.paper, paddingLeft: insets.left, paddingRight: insets.right },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="place-search" options={{ presentation: 'modal', title: tr('Choose a place') }} />
        <Stack.Screen name="results" options={{ title: tr('Journeys') }} />
        <Stack.Screen name="journey/[id]" options={{ title: tr('Your journey') }} />
        <Stack.Screen name="book/[id]" options={{ title: tr('Book journey') }} />
        <Stack.Screen name="bus-map" options={{ title: tr('Bus routes') }} />
        <Stack.Screen name="about" options={{ title: tr('Privacy & about') }} />
        <Stack.Screen name="metro-timings" options={{ title: tr('Metro lines & timings') }} />
        <Stack.Screen name="airport" options={{ title: tr('Airport') }} />
        <Stack.Screen name="cost" options={{ title: tr('Monthly cost') }} />
      </Stack>
    </PaperProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });
  // Paper-coloured blank screen while fonts load, so nothing flashes in a fallback face.
  if (!loaded)
    return (
      <View style={{ flex: 1, backgroundColor: '#F3EFE6', alignItems: 'center', justifyContent: 'center' }}>
        <Image source={require('../../assets/brand/logo-mark.png')} style={{ width: 96, height: 96 }} accessibilityLabel="Hogona" />
      </View>
    );

  return (
    <SafeAreaProvider>
      <AppStateProvider>
        <ThemedApp />
      </AppStateProvider>
    </SafeAreaProvider>
  );
}
