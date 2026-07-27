import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme.dart';
import '../../../m2_self_report/ui/screens/scan_tab.dart';
import '../../../m5b_insight_engine/ui/screens/archive_tab.dart';
import '../../../m5b_insight_engine/ui/screens/insights_tab.dart';
import 'home_tab.dart';
import 'profile_tab.dart';

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;
  final _homeKey = GlobalKey<HomeTabState>();

  void _switchTo(int i) {
    if (i == 0 && _index != 0) _homeKey.currentState?.reload();
    setState(() => _index = i);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          HomeTab(
            key: _homeKey,
            onScanTap: () => _switchTo(1),
            onInsightsTap: () => _switchTo(2),
            onProfileTap: () => _switchTo(4),
          ),
          const ScanTab(),
          const InsightsTab(),
          const ArchiveTab(),
          const ProfileTab(),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Divider(
            height: 1,
            thickness: 1,
            color: OurobionColors.primary.withValues(alpha: 0.2),
          ),
          NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: OurobionColors.surfaceContainer,
              indicatorColor: OurobionColors.primaryFixed,
              indicatorShape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
              ),
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                final active = states.contains(WidgetState.selected);
                return GoogleFonts.manrope(
                  fontSize: 11,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active
                      ? OurobionColors.brandGoldDark
                      : OurobionColors.onSurfaceVariant,
                );
              }),
              iconTheme: WidgetStateProperty.resolveWith((states) {
                final active = states.contains(WidgetState.selected);
                return IconThemeData(
                  color: active
                      ? OurobionColors.brandGoldDark
                      : OurobionColors.onSurfaceVariant,
                  size: 22,
                );
              }),
            ),
            child: NavigationBar(
              selectedIndex: _index,
              onDestinationSelected: _switchTo,
              elevation: 0,
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home_rounded),
                  label: 'Home',
                ),
                NavigationDestination(
                  icon: Icon(Icons.radar_outlined),
                  selectedIcon: Icon(Icons.radar_rounded),
                  label: 'Scan',
                ),
                NavigationDestination(
                  icon: Icon(Icons.lightbulb_outline_rounded),
                  selectedIcon: Icon(Icons.lightbulb_rounded),
                  label: 'Insights',
                ),
                NavigationDestination(
                  icon: Icon(Icons.inventory_2_outlined),
                  selectedIcon: Icon(Icons.inventory_2_rounded),
                  label: 'Archive',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline_rounded),
                  selectedIcon: Icon(Icons.person_rounded),
                  label: 'Profile',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
