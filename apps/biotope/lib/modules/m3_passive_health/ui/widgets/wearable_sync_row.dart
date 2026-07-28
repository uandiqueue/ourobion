import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../../core/theme.dart';
import '../../index.dart';

/// Read-only "connected source" row for the Scan tab. Deliberately does NOT
/// call [WearableService.syncToday] itself — that method triggers a live
/// HealthKit/Health Connect authorization prompt (see wearable_service.dart),
/// so the actual sync only ever runs from an explicit user action ("Run
/// sweep" on Scan tab, per docs/memory/0006-wearable-sync-best-effort.md:
/// best-effort, .ignore()-style — never surprise-prompt permissions just
/// from a screen render). This widget only presents whatever the caller
/// already has (or hasn't) fetched.
class WearableSyncRow extends StatelessWidget {
  final WearableReading? reading;
  final bool hasSyncedThisSession;

  const WearableSyncRow({
    super.key,
    required this.reading,
    required this.hasSyncedThisSession,
  });

  @override
  Widget build(BuildContext context) {
    final hasData = reading?.hasAnyData ?? false;
    final statusLabel = hasData
        ? 'Synced just now'
        : hasSyncedThisSession
            ? 'No data available'
            : 'Not synced yet';
    final dotColor = hasData ? OurobionColors.deltaPositive : OurobionColors.outline;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
      decoration: BoxDecoration(
        color: OurobionColors.surfaceLowest.withValues(alpha: 0.8),
        border: Border.all(color: OurobionColors.primary.withValues(alpha: 0.4)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Text(
              'Wearable',
              style: GoogleFonts.manrope(
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                color: OurobionColors.onSurface,
              ),
            ),
          ),
          Text(
            statusLabel,
            style: GoogleFonts.manrope(
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
              color: OurobionColors.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}
