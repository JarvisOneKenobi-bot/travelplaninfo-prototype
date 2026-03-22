"use client";

import { useState, useRef, useCallback } from "react";

type VoiceState = "idle" | "recording" | "transcribing";

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceInput({ onTranscription, disabled }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release mic
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) {
          setState("idle");
          return;
        }

        setState("transcribing");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");

          const res = await fetch("/api/assistant/transcribe", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            console.error("Transcription failed:", res.status);
            setState("idle");
            return;
          }

          const data = await res.json();
          if (data.text) {
            onTranscription(data.text);
          }
        } catch (err) {
          console.error("Transcription error:", err);
        }
        setState("idle");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setState("recording");
    } catch (err) {
      console.error("Microphone access denied:", err);
      setState("idle");
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (state === "idle") {
      startRecording();
    } else if (state === "recording") {
      stopRecording();
    }
    // If transcribing, do nothing (wait for it)
  }, [state, disabled, startRecording, stopRecording]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === "transcribing"}
      className={`
        flex items-center justify-center w-9 h-9 rounded-full transition-all
        ${state === "idle" ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100" : ""}
        ${state === "recording" ? "text-red-500 bg-red-50 animate-pulse" : ""}
        ${state === "transcribing" ? "text-orange-400 cursor-wait" : ""}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
      title={
        state === "idle"
          ? "Click to record"
          : state === "recording"
            ? "Click to stop recording"
            : "Transcribing..."
      }
    >
      {state === "transcribing" ? (
        /* Spinner */
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        /* Mic icon */
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 10v2a7 7 0 01-14 0v-2"
          />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}
