import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import fs from "fs";
import path from "path";

// Load OpenAI key server-side
function getOpenAIKey(): string {
  const credPath = path.join(
    process.env.HOME || "/home/jarvis",
    ".openclaw/credentials/openai.json"
  );
  try {
    const data = JSON.parse(fs.readFileSync(credPath, "utf-8"));
    return data.api_key || data.key || "";
  } catch {
    return process.env.OPENAI_API_KEY || "";
  }
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

    // Forward to OpenAI Whisper API
    const openaiKey = getOpenAIKey();
    if (!openaiKey) {
      return NextResponse.json(
        { error: "Transcription service not configured" },
        { status: 503 }
      );
    }

    const whisperForm = new FormData();
    whisperForm.append("file", audioFile, "audio.webm");
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
