// supabase/functions/speech-to-text/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { SpeechClient, protos } from 'npm:@google-cloud/speech@5.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

let speechClient: SpeechClient;
try {
    const credentialsJsonString = Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON');
    if (!credentialsJsonString) {
        throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable not set.');
    }
    const credentials = JSON.parse(credentialsJsonString);
    speechClient = new SpeechClient({ credentials, fallback: true });
    console.log('SpeechClient initialized successfully.');
} catch (error) {
    console.error('Failed to initialize SpeechClient:', error);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!speechClient) {
      throw new Error('SpeechClient is not initialized. Check server logs and environment variables.');
    }

    const { audioBase64, languageCode, contentType } = await req.json();
    console.log('Received request:');
    console.log(`- Content-Type: ${contentType}`);
    console.log(`- Language Code: ${languageCode}`);

    if (!audioBase64 || !languageCode || !contentType) {
        console.error('Missing required parameters: audioBase64, languageCode, or contentType.');
        return new Response(JSON.stringify({ error: 'Missing audioBase64, languageCode, or contentType' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
    }

    console.log(`Preparing transcription request for language: ${languageCode}...`);

    let encoding: protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding;
    let sampleRateHertz: number;

    if (contentType.includes('wav') || contentType.includes('linear16')) {
        encoding = 'LINEAR16';
        sampleRateHertz = 16000;
        console.log(`Using encoding: LINEAR16, Sample rate: ${sampleRateHertz}Hz`);
    } else if (contentType.includes('amr')) {
        encoding = 'AMR';
        sampleRateHertz = 8000;
        console.log(`Using encoding: AMR, Sample rate: ${sampleRateHertz}Hz`);
    } else {
        console.error(`Unsupported contentType: ${contentType}. Requires LINEAR16 (wav) or AMR.`);
        return new Response(JSON.stringify({ error: `Unsupported audio format: ${contentType}.` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

    const audio: protos.google.cloud.speech.v1.IRecognitionAudio = { content: audioBase64 };
    const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
      encoding: encoding,
      sampleRateHertz: sampleRateHertz,
      languageCode: languageCode,
      enableAutomaticPunctuation: true,
      audioChannelCount: 1,
    };
    const request: protos.google.cloud.speech.v1.IRecognizeRequest = { audio: audio, config: config };

    console.log('Sending request to Google Cloud Speech-to-Text API with config:', JSON.stringify(config));
    const [response]: [protos.google.cloud.speech.v1.IRecognizeResponse] = await speechClient.recognize(request);
    console.log('Raw API Response:', JSON.stringify(response, null, 2));

    let transcription = '';
    if (response.results && response.results.length > 0) {
      transcription = response.results
        .map(result => result.alternatives && result.alternatives[0] ? result.alternatives[0].transcript : '')
        .filter(transcript => transcript)
        .join('\n');
      if (transcription) {
        console.log('Transcription successful:', transcription);
      } else {
        console.warn('API returned results but no valid transcriptions found.');
      }
    } else if (response.error) {
        console.error('Google API returned an error:', JSON.stringify(response.error));
        throw new Error(`Google API Error: ${response.error.message || 'Unknown API error'}`);
    } else {
      console.warn('API returned no transcription results or error information.');
    }

    return new Response(JSON.stringify({ transcript: transcription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Error processing speech-to-text:', error);
    console.error('Error stack:', error.stack);
    return new Response(JSON.stringify({
        error: error.message || 'An unexpected error occurred while processing the audio.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

console.log(`Function "speech-to-text" up and running!`);