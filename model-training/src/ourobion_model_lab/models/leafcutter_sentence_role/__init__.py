"""Leafcutter Sentence Role v0 -- placeholder package (build unit MT1).

Not yet implemented. Authoritative specification:
docs/temp/model-training/leafcutter-sentence-role-v0-training-plan.md.

MT1 must register a JobSpec here under model_name "leafcutter-sentence-role-v0"
(see ourobion_model_lab.job.register_job) implementing PubMed 200k RCT label
mapping, grouped-abstract splits, the TF-IDF baseline and optional MiniLM
candidate, the CONCLUSIONS-to-finding rule, ONNX export, and the Python-vs-Node
output parity harness. Until then this package intentionally defines nothing
callable.
"""
