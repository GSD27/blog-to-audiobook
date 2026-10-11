
module.exports = async function (context, req) {
  const text = req.body?.text;
  const style = req.body?.style || "adult";

  if (typeof text !== "string" || !text.trim()) {
    context.res = {
      status: 400,
      jsonBody: { error: "Please provide text to read." }
    };
    return;
  }

  if (text.length > 20000) {
    context.res = {
      status: 400,
      jsonBody: { error: "Text must be 20,000 characters or fewer." }
    };
    return;
  }

  const voice = style === "child"
    ? "en-US-AnaNeural"
    : "en-US-AriaNeural";

  try {
    const region = process.env.AZURE_SPEECH_REGION;
    const key = process.env.AZURE_SPEECH_KEY;

    if (!region || !key) {
      throw new Error("Speech settings are missing.");
    }

    const tokenResponse = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: "POST",
        headers: { "Ocp-Apim-Subscription-Key": key }
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Could not authenticate with Speech.");
    }

    const token = await tokenResponse.text();

    const ssml = `
      <speak version="1.0" xml:lang="en-US">
        <voice name="${voice}">
          ${escapeXml(text)}
        </voice>
      </speak>`;

    const speechResponse = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/ssml+xml",
          "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3"
        },
        body: ssml
      }
    );

    if (!speechResponse.ok) {
      throw new Error("Speech generation failed.");
    }

    const audio = Buffer.from(await speechResponse.arrayBuffer());

    context.res = {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="audiobook.mp3"',
        "Cache-Control": "no-store"
      },
      body: audio,
      isRaw: true
    };
  } catch (error) {
    context.log.error("Speech generation error", error.message);
    context.res = {
      status: 500,
      jsonBody: { error: "Unable to generate audio. Please try again." }
    };
  }
};

function escapeXml(value) {
  return value.replace(/[<>&"']/g, char => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;"
  })[char]);
}


