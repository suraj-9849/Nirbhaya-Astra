import { exec } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';
import voice from 'elevenlabs-node';
import express from 'express';
import { promises as fs, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load environment variables
dotenv.config();

// Configuration
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'cgSgspJ2msm6clMCkdW9';
const DEBUG = process.env.DEBUG_ELEVENLABS === 'true';

// Cache for audio and lip-sync files (in-memory for simplicity)
const cache = new Map();

// Create the absolute path for the audios directory
const audiosDir = path.join(process.cwd(), 'audios');
console.log(`Audios directory path: ${audiosDir}`);

// Create audios directory if it doesn't exist
try {
  if (!existsSync(audiosDir)) {
    mkdirSync(audiosDir, { recursive: true });
    console.log(`Created audios directory at ${audiosDir}`);
  }
} catch (error) {
  console.error(`Error creating audios directory: ${error.message}`);
}

// Initialize Gemini API
let genAI;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  console.log('Gemini API initialized');
} else {
  console.warn('WARNING: GEMINI_API_KEY not set in environment variables!');
}

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors());

// System instructions for the AI
const systemInstructions = `You are a virtual therapy bot designed to provide emotional support and advice to women.
Your goal is to listen empathetically and offer thoughtful, comforting advice.
Respond with a JSON array of messages (max 3). Each message should include the following properties:
- text: The message you are sending to the user.
- facialExpression: The emotional tone of your message (e.g., smile, sad, calm, concerned, supportive).
- animation: The animation corresponding to the emotional tone (e.g., Talking_0, Talking_1, Talking_2, Idle, Supportive, Relaxed).
Your response should be in proper JSON format with a messages array.`;

// Routes
app.get('/', (req, res) => {
  res.send('Virtual Therapy Bot is running! Try POST /chat to interact.');
});

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    geminiApiAvailable: !!GEMINI_API_KEY,
    elevenLabsApiAvailable: !!ELEVENLABS_API_KEY,
    audiosDirectoryPath: audiosDir,
    audiosDirectoryExists: existsSync(audiosDir),
    ffmpegPath: getFfmpegPath(),
    rhubarbPath: getRhubarbPath() 
  });
});

app.get('/voices', async (req, res) => {
  if (!ELEVENLABS_API_KEY) {
    return res.status(400).json({ error: 'ElevenLabs API key not configured' });
  }
  
  try {
    const voices = await voice.getVoices(ELEVENLABS_API_KEY);
    res.json(voices);
  } catch (error) {
    console.error('Error fetching voices:', error);
    res.status(500).json({ 
      error: 'Failed to fetch voices from ElevenLabs', 
      details: error.message
    });
  }
});

// Helper functions
const getFfmpegPath = () => {
  // Try environment variable first
  if (process.env.FFMPEG_PATH) {
    if (existsSync(process.env.FFMPEG_PATH)) {
      return process.env.FFMPEG_PATH;
    }
    console.warn(`FFMPEG_PATH environment variable set but file doesn't exist: ${process.env.FFMPEG_PATH}`);
  }
  
  // Try project-specific locations
  const localPath = path.join(process.cwd(), 'bin', 'ffmpeg.exe');
  if (existsSync(localPath)) {
    return localPath;
  }
  
  // Try common Windows locations
  const commonPaths = [
    'C:\\ffmpeg\\bin\\ffmpeg.exe',
    'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
    'ffmpeg'  // Try system path
  ];
  
  for (const p of commonPaths) {
    if (p === 'ffmpeg' || existsSync(p)) {
      return p;
    }
  }
  
  // Default to 'ffmpeg' command and hope it's in the PATH
  return 'ffmpeg';
};

const getRhubarbPath = () => {
  if (process.env.RHUBARB_PATH && existsSync(process.env.RHUBARB_PATH)) {
    return process.env.RHUBARB_PATH;
  }
  return null; // Return null instead of a default to indicate not available
};

const execCommand = (command) => {
  if (DEBUG) console.log(`Executing command: ${command}`);
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Command error: ${error.message}`);
        if (stderr) console.error(`Command stderr: ${stderr}`);
        reject(error);
      } else {
        if (DEBUG && stdout) console.log(`Command stdout: ${stdout.substring(0, 200)}...`);
        resolve(stdout);
      }
    });
  });
};

const generateDefaultLipsync = async (jsonFile, duration = 1.0) => {
  // Create a simple default lipsync JSON with basic mouth movement
  const defaultLipsync = {
    mouthCues: [
      { start: 0, end: duration / 3, value: "X" },
      { start: duration / 3, end: (duration / 3) * 2, value: "A" },
      { start: (duration / 3) * 2, end: duration, value: "X" }
    ]
  };
  
  try {
    await fs.writeFile(jsonFile, JSON.stringify(defaultLipsync), 'utf8');
    return defaultLipsync;
  } catch (error) {
    console.error(`Error creating default lipsync JSON: ${error.message}`);
    return { mouthCues: [{ start: 0, end: 0.1, value: "X" }] };
  }
};

const lipSyncMessage = async (messageIndex, text) => {
  try {
    const cacheKey = `${messageIndex}_${text}`;
    if (cache.has(cacheKey)) {
      if (DEBUG) console.log(`Using cached lip-sync for ${cacheKey}`);
      return cache.get(cacheKey);
    }

    const time = new Date().getTime();
    const mp3File = path.join(audiosDir, `message_${messageIndex}.mp3`);
    const wavFile = path.join(audiosDir, `message_${messageIndex}.wav`);
    const jsonFile = path.join(audiosDir, `message_${messageIndex}.json`);

    if (DEBUG) {
      console.log(`Starting conversion for message ${messageIndex}`);
      console.log(`MP3 file: ${mp3File}`);
      console.log(`WAV file: ${wavFile}`);
      console.log(`JSON file: ${jsonFile}`);
    }

    // Check if the mp3 file exists
    if (!existsSync(mp3File)) {
      console.error(`MP3 file does not exist: ${mp3File}`);
      return await generateDefaultLipsync(jsonFile);
    }

    const ffmpegPath = getFfmpegPath();
    const rhubarbPath = getRhubarbPath();

    // Convert MP3 to WAV using ffmpeg with proper path
    try {
      const convertCommand = `"${ffmpegPath}" -y -i "${mp3File}" "${wavFile}"`;
      await execCommand(convertCommand);
      
      // Check if WAV conversion was successful
      if (!existsSync(wavFile)) {
        console.error(`WAV file was not created: ${wavFile}`);
        return await generateDefaultLipsync(jsonFile);
      }
    } catch (error) {
      console.error(`Error converting MP3 to WAV: ${error.message}`);
      return await generateDefaultLipsync(jsonFile);
    }

    // Generate lipsync data if Rhubarb is available
    let lipsync;
    if (rhubarbPath) {
      try {
        const generateLipSyncCommand = `"${rhubarbPath}" -f json -o "${jsonFile}" "${wavFile}" -r phonetic`;
        await execCommand(generateLipSyncCommand);
        lipsync = await readJsonTranscript(jsonFile);
      } catch (error) {
        console.error(`Error during lip sync generation: ${error.message}`);
        lipsync = await generateDefaultLipsync(jsonFile);
      }
    } else {
      if (DEBUG) console.log('Rhubarb not available, using default lipsync');
      lipsync = await generateDefaultLipsync(jsonFile);
    }

    cache.set(cacheKey, lipsync); // Cache the result
    if (DEBUG) console.log(`Lip sync and conversion done in ${new Date().getTime() - time}ms`);
    return lipsync;
  } catch (error) {
    console.error(`Lip sync error for message ${messageIndex}:`, error);
    // Return a default lipsync object in case of error
    return {
      mouthCues: [
        { start: 0, end: 0.1, value: "X" }
      ]
    };
  }
};

const readJsonTranscript = async (file) => {
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading JSON file ${file}:`, error);
    return {
      mouthCues: [
        { start: 0, end: 0.1, value: "X" }
      ]
    };
  }
};

const audioFileToBase64 = async (file) => {
  try {
    if (!existsSync(file)) {
      console.error(`Audio file does not exist: ${file}`);
      return '';
    }
    
    const data = await fs.readFile(file);
    return data.toString('base64');
  } catch (error) {
    console.error(`Error reading audio file ${file}:`, error);
    return '';
  }
};

// Main chat endpoint
app.post('/chat', async (req, res) => {
  console.log('Received chat request');
  const userMessage = req.body.message;
  
  // If no user message, send a greeting
  if (!userMessage) {
    try {
      res.json({
        messages: [
          {
            text: 'Hello! How can I support you today?',
            facialExpression: 'smile',
            animation: 'Talking_0',
          },
        ],
      });
    } catch (error) {
      console.error('Error sending intro message:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
    return;
  }
  
  // Check for API keys
  if (!ELEVENLABS_API_KEY || !GEMINI_API_KEY) {
    const missingKeys = [];
    if (!GEMINI_API_KEY) missingKeys.push('GEMINI_API_KEY');
    if (!ELEVENLABS_API_KEY) missingKeys.push('ELEVENLABS_API_KEY');
    
    res.json({
      messages: [
        {
          text: `API keys are missing: ${missingKeys.join(', ')}. Please check your environment variables.`,
          facialExpression: 'concerned',
          animation: 'Talking_0',
        },
      ],
    });
    return;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const prompt = `${systemInstructions}\n\nUser message: ${userMessage}`;
    
    console.log('Sending prompt to Gemini API...');
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();

    if (DEBUG) console.log('Full response: ', textResponse);

    let messages;
    try {
      let jsonText = textResponse;
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0].trim();
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1].split('```')[0].trim();
      }
      messages = JSON.parse(jsonText).messages || JSON.parse(jsonText);
      if (DEBUG) console.log('Parsed JSON response:', messages);
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      res.status(500).json({ error: 'Error parsing response from Gemini API' });
      return;
    }

    // Limit to just one message to avoid ElevenLabs rate limiting
    const limitedMessages = messages.slice(0, 1);
    
    const tasks = limitedMessages.map(async (message, index) => {
      try {
        const fileName = path.join(audiosDir, `message_${index}.mp3`);
        
        if (!cache.has(fileName) || !cache.has(`${index}_${message.text}`)) {
          // Generate audio with ElevenLabs
          let audioGenerated = false;
          try {
            console.log(`Generating audio for message ${index} using ElevenLabs API`);
            
            // Try up to 3 times with exponential backoff
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                await voice.textToSpeech(ELEVENLABS_API_KEY, VOICE_ID, fileName, message.text);
                audioGenerated = true;
                break;
              } catch (elevenLabsError) {
                console.error(`ElevenLabs API error (attempt ${attempt + 1}/3):`, elevenLabsError.message);
                if (elevenLabsError.response?.status === 401) {
                  console.error('ElevenLabs API authentication failed. Check your API key.');
                  break; // Don't retry on auth failures
                }
                
                if (attempt < 2) {
                  const delay = Math.pow(2, attempt) * 1000;
                  console.log(`Retrying in ${delay}ms...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                }
              }
            }
          } catch (error) {
            console.error(`Error generating audio: ${error.message}`);
          }
          
          if (!audioGenerated) {
            console.log('Using default empty audio');
            // Create an empty audio file as fallback
            try {
              // Check if the audios directory exists
              if (!existsSync(audiosDir)) {
                mkdirSync(audiosDir, { recursive: true });
              }
              
              // Create a 1-second silent MP3 file using ffmpeg
              const ffmpegPath = getFfmpegPath();
              await execCommand(`"${ffmpegPath}" -f lavfi -i anullsrc=r=44100:cl=mono -t 1 -q:a 9 -acodec libmp3lame "${fileName}"`);
            } catch (ffmpegError) {
              console.error(`Error creating empty audio: ${ffmpegError.message}`);
            }
          }
          
          // Generate lipsync data
          try {
            message.lipsync = await lipSyncMessage(index, message.text);
          } catch (lipSyncError) {
            console.error(`Error generating lipsync: ${lipSyncError.message}`);
            message.lipsync = {
              mouthCues: [{ start: 0, end: 0.1, value: "X" }]
            };
          }
          
          // Convert audio to base64
          try {
            message.audio = await audioFileToBase64(fileName);
            cache.set(fileName, message.audio); // Cache audio
          } catch (audioError) {
            console.error(`Error with audio file: ${audioError.message}`);
            message.audio = '';
          }
        } else {
          message.audio = cache.get(fileName);
          message.lipsync = cache.get(`${index}_${message.text}`);
          console.log(`Using cached data for message ${index}`);
        }
        return message;
      } catch (error) {
        console.error(`Error processing message ${index}:`, error);
        // Return the message without audio/lipsync in case of error
        return {
          ...message,
          audio: '',
          lipsync: {
            mouthCues: [{ start: 0, end: 0.1, value: "X" }]
          }
        };
      }
    });

    const processedMessages = await Promise.all(tasks);
    res.json({ messages: processedMessages });
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message,
      stack: DEBUG ? error.stack : undefined
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Virtual Therapy Bot listening on port ${PORT}`);
  console.log(`Audios directory: ${audiosDir}`);
  console.log(`FFmpeg path: ${getFfmpegPath()}`);
  console.log(`Rhubarb path: ${getRhubarbPath() || 'Not configured'}`);
});