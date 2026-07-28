// app/lib/modules/m4_environmental/index.dart

/*
M4: Environmental & Outbreak
Status: DEFERRED (Phase 1 Stage 3) — NOT STARTED.

This file is the whole module. There is no service, model, screen, table, edge
function or environmental API behind it anywhere in the repo, and there is no
`ui/` subfolder. `shared/types/index.ts` declares a DailyEnvRow shape
(green_cover_bucket / dengue_case_rate / outbreak_alert_active) used
server-side, but nothing in the Flutter app reads it.

The only client-side trace of M4 is the Scan tab's environmental row —
`EnvironmentRow` in modules/m2_self_report/ui/screens/scan_tab.dart — which is
deliberately inert and says on its face that no environmental data source is
connected. Do not "enable" that row until this module actually exists: a
control wired to nothing is worse than a labelled gap.

Future Public Interface
*/
