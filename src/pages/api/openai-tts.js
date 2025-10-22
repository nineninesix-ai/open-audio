// Next.js API route for OpenAI-compatible TTS
import OpenAI from 'openai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiUrl, apiKey, input, voice, model, streaming, responseFormat } = req.body;

    // Validate required fields
    if (!apiUrl || !input) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize OpenAI client with custom base URL
    const openai = new OpenAI({
      apiKey: apiKey || 'dummy-key', // Some servers don't require auth
      baseURL: `${apiUrl}/v1`,
    });

    // Determine format based on streaming mode
    // Streaming: PCM only
    // Non-streaming: WAV or PCM
    let stream_format;
    if (streaming) {
      stream_format = "sse"
    } else {
      stream_format = "audio"
    }

    // Create speech
    const response = await openai.audio.speech.create({
      model: model || 'tts-1',
      voice: voice || 'andrew',
      input: input,
      stream_format: stream_format,
      response_format: responseFormat,
      max_chunk_duration: 12.0,
      silence_duration: 0.2
    });

    // Set appropriate headers
    const contentType = responseFormat === 'wav' ? 'audio/wav' : 'audio/pcm';
    res.setHeader('Content-Type', contentType);

    if (streaming) {
      res.setHeader('Transfer-Encoding', 'chunked');
    }

    // Stream the response body to the client
    const stream = response.body;

    // Handle Node.js stream
    if (stream.pipe) {
      stream.pipe(res);
    } else {
      // Handle Web ReadableStream (if SDK returns web stream)
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }

      res.end();
    }
  } catch (error) {
    console.error('TTS API Error:', error);

    // Check if it's an OpenAI API error with status code
    if (error.status) {
      return res.status(error.status).json({
        error: 'TTS API Error',
        details: error.message || `${error.status} status code`,
        body: error.error || null
      });
    }

    res.status(500).json({
      error: 'Failed to generate speech',
      details: error.message
    });
  }
}
