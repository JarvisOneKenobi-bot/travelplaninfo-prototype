import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getOpenAIApiKey } from "@/lib/server-config";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
]);
const MIME_TYPE_TO_EXTENSION: Record<string, string> = {
  "audio/webm": "webm",
  "audio/mp4": "mp4",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
};

function getUploadFileName(audioFile: File): string {
  const trimmedName = audioFile.name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  const extension = MIME_TYPE_TO_EXTENSION[audioFile.type] || "bin";
  return `audio.${extension}`;
}

export async function POST(req: NextRequest) {
  // Auth gate
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    if (!ALLOWED_AUDIO_TYPES.has(audioFile.type)) {
      return NextResponse.json(
        { error: "Unsupported audio format" },
        { status: 400 }
      );
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "Audio file too large" },
        { status: 413 }
      );
    }

    // Forward to OpenAI Whisper API
    const openaiKey = getOpenAIApiKey();
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Transcription service not configured" },
        { status: 503 }
      );
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, getUploadFileName(audioFile));
    whisperForm.append("model", "whisper-1");
    whisperForm.append("language", "en");

    const whisperRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
        body: whisperForm,
      }
    );

    if (!whisperRes.ok) {
      const errBody = await whisperRes.text();
      console.error("Whisper API error:", whisperRes.status, errBody);
      return NextResponse.json(
        { error: "Transcription failed" },
        { status: 502 }
      );
    }

    const result = await whisperRes.json();
    return NextResponse.json({ text: result.text || "" });
  } catch (err) {
    console.error("Transcription route error:", err);
    return NextResponse.json(
      { error: "Transcription service error" },
      { status: 500 }
    );
  }
}
