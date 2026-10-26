import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { Logo } from '../../components/Logo';
import { useAppTheme } from '../../components/ui';
import { FONTS } from '../../constants/theme';
import { useT } from '../../i18n';

const TABS = [
  { name: 'index', title: 'Plan' },
  { name: 'map', title: 'Map' },
  { name: 'saved', title: 'Saved' },
  { name: 'activity', title: 'Activity' },
  { name: 'settings', title: 'Settings' },
] as const;

/** Text-only tab bar: the active tab is ink with a short rule above it. */
export default function TabsLayout() {
  const t = useAppTheme();
  const tr = useT();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: t.ink.paper },
        headerShadowVisible: false,
        headerTintColor: t.ink.ink,
        headerTitleStyle: { fontFamily: FONTS.serif, fontSize: 26, letterSpacing: -0.4 },
        headerTitleAlign: 'left',
        tabBarStyle: { backgroundColor: t.ink.paper, borderTopColor: t.ink.rule },
        tabBarIconStyle: { display: 'none' },
        headerRight: () => (
          <View style={{ marginRight: 16 }}>
            <Logo variant="mark" size={28} />
          </View>
        ),
        sceneStyle: { backgroundColor: t.ink.paper },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tr(tab.title),
            headerShown: tab.name !== 'index',
            tabBarIcon: () => null,
            tabBarLabel: ({ focused }) => (
              <View style={styles.tab}>
                <View style={[styles.mark, { backgroundColor: focused ? t.ink.ink : 'transparent' }]} />
                <Text style={[styles.label, { color: focused ? t.ink.ink : t.ink.faint, fontFamily: focused ? FONTS.sansSemi : FONTS.sansMedium }]}>{tr(tab.title)}</Text>
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tab: { alignItems: 'center', gap: 7, paddingTop: 2 },
  mark: { width: 18, height: 2, borderRadius: 1 },
  label: { fontSize: 13, letterSpacing: 0.2 },
});
