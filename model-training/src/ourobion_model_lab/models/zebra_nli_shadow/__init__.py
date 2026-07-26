"""Zebra NLI Shadow v0 -- placeholder package (build unit MT3).

Not yet implemented. Authoritative specification:
docs/temp/model-training/zebra-nli-shadow-v0-training-plan.md.

MT3 must register a JobSpec here under model_name "zebra-nli-shadow-v0"
implementing the SciFact manifest/transform adapter, claim/evidence pair
encoding, grouped leakage checks and five-fold preparation, the fixed
BiomedBERT three-class recipe, out-of-fold calibration, and the frozen
LLM-comparator import (hashed outputs only, no API calls). Until then this
package intentionally defines nothing callable.
"""
