// shared/types/index.dart

class DailyGutRow {
  final String id;
  final String userId;
  final String date;
  final String region;
  
  final int? urineColour;
  final int? stoolCount;
  final int? stoolForm;
  final int? stoolVariability;
  
  final int? outsideMeals;
  final int? mosquitoBites;
  final bool? standingWaterPresent;
  
  final bool? onAntibiotics;
  final bool? gutWatchActive;
  
  final int? energyScore;
  final int? moodScore;
  final int? gutComfortScore;
  
  final List<String> symptomFlags;
  final String? notes;
  
  final double logCompleteness;
  final DateTime createdAt;
  final DateTime updatedAt;

  // TODO: Add constructor, copyWith, fromJson, toJson
  DailyGutRow({
    required this.id,
    required this.userId,
    required this.date,
    required this.region,
    this.urineColour,
    this.stoolCount,
    this.stoolForm,
    this.stoolVariability,
    this.outsideMeals,
    this.mosquitoBites,
    this.standingWaterPresent,
    this.onAntibiotics,
    this.gutWatchActive,
    this.energyScore,
    this.moodScore,
    this.gutComfortScore,
    this.symptomFlags = const [],
    this.notes,
    required this.logCompleteness,
    required this.createdAt,
    required this.updatedAt,
  });
}

// TODO: Add DailyPhysioRow, DailyEnvRow, BaselineSnapshot, InsightCard, InsightFiredEvent, EngagementState
