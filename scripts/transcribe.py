#!/usr/bin/env python3
"""
transcribe.py — Audio Transcription Script for WinJob AI Interview Predictor
─────────────────────────────────────────────────────────────────────────────
Called by routes/aiInterview.js via Node.js child_process.execFile.
Prints the transcribed text to stdout; errors go to stderr.

Usage:
    python transcribe.py <audio_file_path>

Dependencies (install once):
    pip install faster-whisper

Fallback (if faster-whisper is unavailable):
    pip install openai-whisper
"""

import sys
import os


def transcribe(audio_path: str) -> str:
    """
    Transcribe an audio file to text.
    Tries faster-whisper first, falls back to openai-whisper.
    """
    try:
        from faster_whisper import WhisperModel

        # 'small' balances speed and accuracy; use 'medium' for better quality
        model = WhisperModel("small", device="cpu", compute_type="int8")
        segments, _ = model.transcribe(audio_path, beam_size=5)
        return " ".join(seg.text.strip() for seg in segments).strip()

    except ImportError:
        # Fallback to openai-whisper if faster-whisper is not installed
        try:
            import whisper
            model = whisper.load_model("small")
            result = model.transcribe(audio_path)
            return result["text"].strip()

        except ImportError:
            raise RuntimeError(
                "No transcription library found. "
                "Run: pip install faster-whisper"
            )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file_path>", file=sys.stderr)
        sys.exit(1)

    audio_file = sys.argv[1]

    if not os.path.isfile(audio_file):
        print(f"Error: File not found: {audio_file}", file=sys.stderr)
        sys.exit(1)

    try:
        result = transcribe(audio_file)
        print(result)          # stdout is captured by Node.js
        sys.exit(0)
    except Exception as exc:
        print(f"Transcription error: {exc}", file=sys.stderr)
        sys.exit(1)
