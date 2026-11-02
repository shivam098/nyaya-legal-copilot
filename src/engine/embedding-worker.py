#!/usr/bin/env python3
"""
Local Neural Multilingual Embedding Worker for Nyaya Legal Co-Pilot
Uses Xenova/multilingual-e5-small (int8 quantized ONNX Runtime + HuggingFace Tokenizers)
to generate 384-dimensional L2-normalized dense neural embeddings for English, Hindi (Devanagari),
and Roman Hinglish legal queries and statutory provisions.
"""

import sys
import json
import os
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer
from huggingface_hub import hf_hub_download

REPO_ID = "Xenova/multilingual-e5-small"
_SESSION = None
_TOKENIZER = None


def get_model():
    global _SESSION, _TOKENIZER
    if _SESSION is None or _TOKENIZER is None:
        tok_path = hf_hub_download(repo_id=REPO_ID, filename="tokenizer.json")
        onnx_path = hf_hub_download(repo_id=REPO_ID, filename="onnx/model_quantized.onnx")
        _TOKENIZER = Tokenizer.from_file(tok_path)
        _TOKENIZER.enable_truncation(max_length=512)
        _TOKENIZER.enable_padding(pad_id=1, pad_token="<pad>")
        sess_opts = ort.SessionOptions()
        sess_opts.intra_op_num_threads = min(8, os.cpu_count() or 4)
        _SESSION = ort.InferenceSession(onnx_path, sess_options=sess_opts, providers=["CPUExecutionProvider"])
    return _SESSION, _TOKENIZER


def embed_texts(texts, prefix="query: "):
    sess, tok = get_model()
    formatted = [f"{prefix}{t.strip()}" for t in texts]
    encodings = tok.encode_batch(formatted)
    input_ids = np.array([e.ids for e in encodings], dtype=np.int64)
    attention_mask = np.array([e.attention_mask for e in encodings], dtype=np.int64)

    inputs = {
        "input_ids": input_ids,
        "attention_mask": attention_mask,
    }
    if any(i.name == "token_type_ids" for i in sess.get_inputs()):
        inputs["token_type_ids"] = np.zeros_like(input_ids)

    outputs = sess.run(None, inputs)[0]
    mask_exp = np.expand_dims(attention_mask, -1).astype(np.float32)
    summed = (outputs * mask_exp).sum(axis=1)
    counts = np.clip(mask_exp.sum(axis=1), 1e-9, None)
    pooled = summed / counts
    norms = np.clip(np.linalg.norm(pooled, axis=1, keepdims=True), 1e-9, None)
    normalized = pooled / norms
    return normalized.tolist()


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            req_id = req.get("id", "1")
            texts = req.get("texts", [])
            prefix = req.get("prefix", "query: ")
            vecs = embed_texts(texts, prefix=prefix)
            sys.stdout.write(json.dumps({"id": req_id, "ok": True, "embeddings": vecs}) + "\n")
            sys.stdout.flush()
        except Exception as exc:
            sys.stdout.write(json.dumps({"id": req.get("id", "1") if isinstance(req, dict) else "1", "ok": False, "error": str(exc)}) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
