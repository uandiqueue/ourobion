"""Salmon Relation/Direction v0 -- placeholder package (build unit MT4).

Not yet implemented. Authoritative specification:
docs/temp/model-training/salmon-relation-direction-v0-training-plan.md.

MT4 must register a JobSpec here under model_name "salmon-relation-direction-v0"
implementing the BioRED/BioREDirect/DrugProt/ChemProt adapters behind explicit
licence manifests, typed entity markers, the shared encoder with relation and
direction heads, per-example direction-label masking, and PMID de-duplication
across corpora. BioREDirect's data licence is unresolved (see
docs/temp/model-training/human-gates.md) -- the code must fail closed by
default and no direction training may run without an approved licence
artifact. Until then this package intentionally defines nothing callable.
"""
