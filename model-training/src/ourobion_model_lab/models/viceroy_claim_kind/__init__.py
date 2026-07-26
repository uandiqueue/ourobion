"""Viceroy Claim Kind v0 -- placeholder package (build unit MT5).

Not yet implemented. Authoritative specification:
docs/temp/model-training/viceroy-claim-kind-v0-training-plan.md.

MT5 must register a JobSpec here under model_name "viceroy-claim-kind-v0"
implementing the Yu/Li/Wang four-class adapter, explicit non-coverage for
mechanistic, PMID-grouped folds, the fixed BiomedBERT recipe, and a release
namespace isolated from every other model. The underlying data is GPL-3.0;
that review is a hard gate (see docs/temp/model-training/human-gates.md) --
the code must refuse real data/training unless a signed decision artifact
permits the intended use, and must never encode a legal conclusion itself.
Until then this package intentionally defines nothing callable.
"""
