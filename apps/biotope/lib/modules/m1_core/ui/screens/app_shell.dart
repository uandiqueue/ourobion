import 'package:flutter/material.dart';
import '../../../../core/app_preferences.dart';
import '../../../../core/theme.dart';
import '../../../../core/widgets/biotope_bottom_navigation.dart';
import '../../../../core/widgets/biotope_screen_entrance.dart';
import '../../../m2_self_report/ui/screens/scan_tab.dart';
import '../../../m5b_insight_engine/ui/screens/archive_tab.dart';
import '../../../m5b_insight_engine/ui/screens/insights_tab.dart';
import 'home_tab.dart';
import 'profile_tab.dart';
import '../widgets/living_backdrop.dart';

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
      backgroundColor: Colors.transparent,
      extendBody: true,
      body: Stack(
        children: [
          Positioned.fill(
            child: ValueListenableBuilder<bool>(
              valueListenable: AppPreferences.backdropEnabled,
              builder: (context, enabled, child) => enabled
                  ? const LivingBackdrop()
                  : const ColoredBox(color: OurobionColors.background),
            ),
          ),
          IndexedStack(
            index: _index,
            children: [
              BiotopeScreenEntrance(
                active: _index == 0,
                child: HomeTab(
                  key: _homeKey,
                  onScanTap: () => _switchTo(1),
                  onInsightsTap: () => _switchTo(2),
                  onProfileTap: () => _switchTo(4),
                ),
              ),
              BiotopeScreenEntrance(active: _index == 1, child: const ScanTab()),
              BiotopeScreenEntrance(active: _index == 2, child: const InsightsTab()),
              BiotopeScreenEntrance(
                active: _index == 3,
                child: ArchiveTab(active: _index == 3),
              ),
              BiotopeScreenEntrance(active: _index == 4, child: const ProfileTab()),
            ],
          ),
        ],
      ),
      bottomNavigationBar: BiotopeBottomNavigation(
        selectedIndex: _index,
        onSelected: _switchTo,
      ),
    );
  }
}
