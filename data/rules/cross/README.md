# data/rules/cross — cross-metric rule blueprints

Blueprints whose `scope` is `cross` (2+ `metricKeys`, a `coincidence` condition — see
[`shared/rules/README.md`](../../../shared/rules/README.md)) live here as
`<category>/<rule_id>.json`, one file per rule.

Intentionally empty for now: the first cross rule lands with the engine refactor (rules-engine-design
step C), which ships the `coincidence` evaluator it needs. The loader and guards already validate
this directory, so dropping a blueprint in is all it takes.
