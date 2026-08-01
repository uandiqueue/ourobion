// ourobion nao — Data loader unavailable state.
//
// The loader UI is deliberately not offered. Its server side (api/loader and
// api/loader/run-pipeline) is intact and still gated — the capability is
// preserved, it is just not presented, because no demo target is registered for
// it to write to, so every load a visitor could start would be refused. A form
// that cannot succeed reads as a broken feature rather than an unbuilt one, so
// the target field, "Load days" and "Run analysis" are gone rather than
// disabled: a control a visitor can hover and click at is still an invitation.
//
// No client state, no fetch, no interactive control — this is a static panel and
// stays a Server Component. It reuses the panel/eyebrow/fmt__cap pattern that
// ModelsPanel and ClaimsPanel use for their honest empty states rather than
// introducing a notice style of its own.

export function LoaderPanel() {
  return (
    <div className="panel ingest-panel">
      <div className="eyebrow panel__label">Coming soon</div>
      <p className="fmt__cap">
        Loading demo health data and running the analysis pipeline isn&apos;t available yet.
      </p>
      <p className="fmt__cap">
        When it arrives, this page will load a stretch of simulated, provenance-flagged days for a
        demo account and take them through the serve pipeline — baselines, then signals, then
        insights — so the overview, claims and gap surfaces have a real run to read.
      </p>
    </div>
  );
}
