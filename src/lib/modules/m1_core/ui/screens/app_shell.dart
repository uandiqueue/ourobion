import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../core/theme.dart';
import '../../../m2_self_report/ui/screens/daily_log_screen.dart';
import '../../../m5b_insight_engine/ui/screens/insights_tab.dart';
import 'home_tab.dart';

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
          HomeTab(key: _homeKey, onLogTodayTap: () => _switchTo(1)),
          const DailyLogScreen(),
          const InsightsTab(),
          const _PlaceholderTab(
            label: 'Squad',
            icon: Icons.group_outlined,
            subtitle: 'Compare gut health trends with friends.',
          ),
          const _PlaceholderTab(
            label: 'World',
            icon: Icons.public_outlined,
            subtitle: 'Environmental and regional outbreak signals.',
          ),
        ],
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Divider(
            height: 1,
            thickness: 1,
            color: BiotopeColors.outlineVariant,
          ),
          NavigationBarTheme(
            data: NavigationBarThemeData(
              backgroundColor: BiotopeColors.surfaceContainer,
              indicatorColor: BiotopeColors.primaryFixed,
              indicatorShape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(6),
              ),
              labelTextStyle: WidgetStateProperty.resolveWith((states) {
                final active = states.contains(WidgetState.selected);
                return GoogleFonts.manrope(
                  fontSize: 11,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                  color: active
                      ? BiotopeColors.primary
                      : BiotopeColors.onSurfaceVariant,
                );
              }),
              iconTheme: WidgetStateProperty.resolveWith((states) {
                final active = states.contains(WidgetState.selected);
                return IconThemeData(
                  color: active
                      ? BiotopeColors.primary
                      : BiotopeColors.onSurfaceVariant,
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
                  icon: Icon(Icons.edit_note_outlined),
                  selectedIcon: Icon(Icons.edit_note_rounded),
                  label: 'Log',
                ),
                NavigationDestination(
                  icon: Icon(Icons.lightbulb_outline_rounded),
                  selectedIcon: Icon(Icons.lightbulb_rounded),
                  label: 'Insights',
                ),
                NavigationDestination(
                  icon: Icon(Icons.group_outlined),
                  selectedIcon: Icon(Icons.group_rounded),
                  label: 'Squad',
                ),
                NavigationDestination(
                  icon: Icon(Icons.public_outlined),
                  selectedIcon: Icon(Icons.public_rounded),
                  label: 'World',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Placeholder tab ────────────────────────────────────────────────────────────

class _PlaceholderTab extends StatelessWidget {
  final String label;
  final String subtitle;
  final IconData icon;

  const _PlaceholderTab({
    required this.label,
    required this.icon,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BiotopeColors.surface,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: BiotopeColors.primaryFixed,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Icon(icon, size: 32, color: BiotopeColors.primary),
                ),
                const SizedBox(height: 16),
                Text(
                  label,
                  style: GoogleFonts.manrope(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                    color: BiotopeColors.onSurface,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  subtitle,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.manrope(
                    fontSize: 13,
                    color: BiotopeColors.outline,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Coming soon',
                  style: GoogleFonts.manrope(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                    color: BiotopeColors.outlineVariant,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
