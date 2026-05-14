import 'package:supabase_flutter/supabase_flutter.dart';

class AntibioticCourse {
  final int id;
  final String drugName;
  final DateTime startDate;
  final int durationDays;
  final DateTime endDate;
  final bool completed;
  final bool reminderEnabled;

  const AntibioticCourse({
    required this.id,
    required this.drugName,
    required this.startDate,
    required this.durationDays,
    required this.endDate,
    required this.completed,
    required this.reminderEnabled,
  });

  factory AntibioticCourse.fromMap(Map<String, dynamic> map) {
    return AntibioticCourse(
      id: map['id'] as int,
      drugName: map['drug_name'] as String,
      startDate: DateTime.parse(map['start_date'] as String),
      durationDays: map['duration_days'] as int,
      endDate: DateTime.parse(map['end_date'] as String),
      completed: map['completed'] as bool? ?? false,
      reminderEnabled: map['reminder_enabled'] as bool? ?? false,
    );
  }
}

class AntibioticService {
  final SupabaseClient _client;
  AntibioticService(this._client);

  Future<void> addCourse({
    required String userId,
    required String drugName,
    required DateTime startDate,
    required int durationDays,
    bool reminderEnabled = false,
  }) async {
    final endDate = startDate.add(Duration(days: durationDays - 1));
    await _client.from('antibiotic_courses').insert({
      'user_id': userId,
      'drug_name': drugName.trim(),
      'start_date': _fmt(startDate),
      'duration_days': durationDays,
      'end_date': _fmt(endDate),
      'completed': false,
      'reminder_enabled': reminderEnabled,
    });
  }

  Future<List<AntibioticCourse>> getCourses(String userId) async {
    final data = await _client
        .from('antibiotic_courses')
        .select()
        .eq('user_id', userId)
        .order('start_date', ascending: false) as List<dynamic>;
    return data
        .map((e) => AntibioticCourse.fromMap(e as Map<String, dynamic>))
        .toList();
  }

  String _fmt(DateTime d) =>
      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
