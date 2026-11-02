import sys
import os
import json
import time
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("NYAYA_WHISPER_MODEL", "large-v3-turbo")
CPU_THREADS = int(os.environ.get("NYAYA_WHISPER_THREADS", "8"))

model = None

def get_model():
    global model
    if model is None:
        model = WhisperModel(
            MODEL_NAME,
            device="cpu",
            compute_type="int8",
            cpu_threads=CPU_THREADS
        )
    return model

def main():
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        req_id = "unknown"
        try:
            req = json.loads(line)
            req_id = req.get("id", "unknown")
            if req.get("command") == "ping":
                sys.stdout.write(json.dumps({"id": req_id, "ok": True, "model": MODEL_NAME}) + "\n")
                sys.stdout.flush()
                continue

            audio_path = req.get("audioPath", "")
            language = req.get("language") or None
            if language in ("auto", "hinglish", ""):
                language = None

            if not audio_path or not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

            t0 = time.time()
            m = get_model()
            segments, info = m.transcribe(
                audio_path,
                language=language,
                beam_size=1,
                vad_filter=True,
                initial_prompt=(
                    "Indian legal conversation in English, Hindi, or Hinglish. "
                    "Terms: FIR, police station, BNS, BNSS, BSA, RERA, Consumer Commission, "
                    "cheque bounce, Section 138, streedhan, maintenance, WhatsApp, refund, rupaye, lakh."
                )
            )
            seg_list = []
            text_parts = []
            for s in segments:
                clean = s.text.strip()
                if clean:
                    text_parts.append(clean)
                    seg_list.append({
                        "start": round(s.start, 2),
                        "end": round(s.end, 2),
                        "text": clean
                    })

            full_text = " ".join(text_parts).strip()
            resp = {
                "id": req_id,
                "ok": True,
                "model": MODEL_NAME,
                "detectedLanguage": getattr(info, "language", "en"),
                "durationSec": round(getattr(info, "duration", 0.0), 2),
                "latencyMs": round((time.time() - t0) * 1000),
                "text": full_text,
                "segments": seg_list
            }
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()
        except Exception as exc:
            err_resp = {
                "id": req_id,
                "ok": False,
                "error": str(exc)
            }
            sys.stdout.write(json.dumps(err_resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
