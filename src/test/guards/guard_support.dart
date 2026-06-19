// Shared parsing helpers for the coupling guard tests in this directory.
// Not a *_test.dart file, so `flutter test` does not run it as a suite.
//
// The guards make cross-language couplings executable by parsing source text (no import links the
// Dart / TypeScript / SQL seam). See docs/graph/couplings.yaml.

import 'dart:io';

/// Walk up from the test working directory (the Flutter package root, `src/`) to the repo root —
/// the first ancestor that contains both `shared/` and `supabase/`.
Directory repoRoot() {
  var dir = Directory.current;
  for (var i = 0; i < 8; i++) {
    final hasShared = Directory('${dir.path}/shared').existsSync();
    final hasSupabase = Directory('${dir.path}/supabase').existsSync();
    if (hasShared && hasSupabase) return dir;
    final parent = dir.parent;
    if (parent.path == dir.path) break;
    dir = parent;
  }
  throw StateError('repo root not found from ${Directory.current.path}');
}

String readRepoFile(String relPath) =>
    File('${repoRoot().path}/$relPath').readAsStringSync();

/// Columns/fields that are system or derived plumbing, not collected metrics. Excluded when
/// comparing a contract row type or a migration table against the metrics registry.
const Set<String> systemOrDerivedColumns = {
  'id',
  'user_id',
  'date',
  'log_date',
  'region',
  'created_at',
  'updated_at',
  'synced_at',
  'source',
  'device_type',
  'data_completeness',
  'on_antibiotics', // derived by M2 from antibiotic_courses
  'gut_watch_active', // derived by M2 from antibiotic_courses
};

/// Field names declared in a TypeScript `export interface <name> { ... }` block.
Set<String> tsInterfaceFields(String tsSource, String name) {
  final re = RegExp('export interface $name\\s*\\{([^}]*)\\}', dotAll: true);
  final m = re.firstMatch(tsSource);
  if (m == null) throw StateError('interface $name not found');
  final body = m.group(1)!;
  final fieldRe = RegExp(r'^\s*([a-z_][a-zA-Z0-9_]*)\??\s*:', multiLine: true);
  return fieldRe.allMatches(body).map((m) => m.group(1)!).toSet();
}

/// For each `class X { ... }` in a Dart source, the set of string-literal keys in its `toJson()`.
Map<String, Set<String>> dartClassToJsonKeys(String dartSource) {
  final result = <String, Set<String>>{};
  final classRe = RegExp(r'class (\w+)');
  final matches = classRe.allMatches(dartSource).toList();
  for (var i = 0; i < matches.length; i++) {
    final name = matches[i].group(1)!;
    final start = matches[i].start;
    final end = (i + 1 < matches.length) ? matches[i + 1].start : dartSource.length;
    final block = dartSource.substring(start, end);
    final tj = block.indexOf('toJson()');
    if (tj < 0) continue;
    final keyRe = RegExp(r"'([a-z0-9_]+)':");
    result[name] = keyRe.allMatches(block.substring(tj)).map((m) => m.group(1)!).toSet();
  }
  return result;
}

/// One parsed metric entry from registry.ts / registry.dart.
class RegistryEntry {
  RegistryEntry(this.key, this.table, this.status, this.baselineApplicable);
  final String key;
  final String table;
  final String status;
  final bool baselineApplicable;
}

/// Parse metric entries (in declaration order) from a registry source (TS or Dart). Both files
/// list one entry per object with `key:`, `table:`, `status:`, `baselineApplicable:` fields.
List<RegistryEntry> parseRegistry(String source) {
  final keyRe = RegExp(r'''key:\s*['"]([a-z0-9_]+)['"]''');
  final keyMatches = keyRe.allMatches(source).toList();
  final entries = <RegistryEntry>[];
  for (var i = 0; i < keyMatches.length; i++) {
    final start = keyMatches[i].start;
    final end = (i + 1 < keyMatches.length) ? keyMatches[i + 1].start : source.length;
    final block = source.substring(start, end);
    final key = keyMatches[i].group(1)!;
    final table = RegExp(r'''table:\s*['"]([a-z0-9_]+)['"]''').firstMatch(block)?.group(1) ?? '';
    final status = RegExp(r'''status:\s*['"]([a-z]+)['"]''').firstMatch(block)?.group(1) ?? '';
    final ba = RegExp(r'baselineApplicable:\s*(true|false)').firstMatch(block)?.group(1) == 'true';
    entries.add(RegistryEntry(key, table, status, ba));
  }
  return entries;
}

/// Active baseline-applicable keys for a table, from a parsed registry.
List<String> baselineKeysFor(List<RegistryEntry> entries, String table) => entries
    .where((e) => e.table == table && e.status == 'active' && e.baselineApplicable)
    .map((e) => e.key)
    .toList();

/// All active keys for a table, from a parsed registry.
Set<String> activeKeysFor(List<RegistryEntry> entries, String table) => entries
    .where((e) => e.table == table && e.status == 'active')
    .map((e) => e.key)
    .toSet();

/// Column names of a `create table <name> ( ... )` block in a migration's SQL.
Set<String> migrationColumns(String sql, String tableName) {
  final re = RegExp(
    'create table[^(]*\\b$tableName\\b[^(]*\\(',
    caseSensitive: false,
  );
  final m = re.firstMatch(sql);
  if (m == null) throw StateError('table $tableName not found in migration');
  // Walk from the opening paren to its matching close, tracking depth.
  var depth = 0;
  var i = m.end - 1;
  final buf = StringBuffer();
  for (; i < sql.length; i++) {
    final c = sql[i];
    if (c == '(') depth++;
    if (c == ')') {
      depth--;
      if (depth == 0) break;
    }
    buf.write(c);
  }
  var body = buf.toString().substring(1); // drop leading '('
  // Strip `-- ...` line comments so a section comment can't swallow the column on the next line.
  body = body.replaceAll(RegExp(r'--[^\n]*'), '');
  final cols = <String>{};
  // One column (or constraint) definition per line. Take the leading identifier of each line that
  // is a column definition (skip table-level constraint lines).
  for (var line in body.split('\n')) {
    line = line.trim();
    if (line.isEmpty) continue;
    final lower = line.toLowerCase();
    if (lower.startsWith('primary key') ||
        lower.startsWith('unique') ||
        lower.startsWith('foreign key') ||
        lower.startsWith('constraint') ||
        lower.startsWith('check')) {
      continue;
    }
    final colMatch = RegExp(r'^([a-z_][a-z0-9_]*)\s+\S').firstMatch(lower);
    if (colMatch != null) cols.add(colMatch.group(1)!);
  }
  return cols;
}
