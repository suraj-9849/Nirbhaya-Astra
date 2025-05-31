import axios from "axios";
import { NextResponse } from "next/server";
import { writeFile, mkdir, readdir, readFile } from "fs/promises";
import { join, extname } from "path";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";
import { UploadApiResponse, v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

// Configure Cloudinary (add these to your .env file)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "diypfqcmd",
  api_key: process.env.CLOUDINARY_API_KEY || "966199493542533",
  api_secret: process.env.CLOUDINARY_API_SECRET || "HyBhlPX-HLvRhyiWnoEH5UXdnDc",
  secure: true
});

// Helper function to get the base URL
function getBaseUrl(req: Request): string {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const host = req.headers.get('host') || 'localhost:3000';
  return `${protocol}://${host}`;
}

// Define path for metadata storage
const METADATA_PATH = join(process.cwd(), 'public', 'uploads', 'metadata');
const UPLOADS_PATH = join(process.cwd(), 'public', 'uploads');

// Function to upload to Cloudinary
function uploadToCloudinary(buffer: Buffer, options: any): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      }
    );
    
    // Convert buffer to stream and pipe to cloudinary
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

// Function to save metadata
async function saveMetadata(metadata: any) {
  try {
    // Ensure metadata directory exists
    await mkdir(METADATA_PATH, { recursive: true });
    
    // Save metadata to JSON file
    const metadataPath = join(METADATA_PATH, `${metadata.id}.json`);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`📝 Metadata saved to ${metadataPath}`);
    return true;
  } catch (error) {
    console.error("❌ Error saving metadata:", error);
    return false;
  }
}

// Function to read local videos metadata
async function getLocalVideos(): Promise<any[]> {
  try {
    // Ensure metadata directory exists
    if (!existsSync(METADATA_PATH)) {
      await mkdir(METADATA_PATH, { recursive: true });
      return [];
    }
    
    // Read metadata directory
    const files = await readdir(METADATA_PATH);
    const metadataFiles = files.filter(file => file.endsWith('.json'));
    
    // Read each metadata file
    const videosPromises = metadataFiles.map(async (file) => {
      try {
        const content = await readFile(join(METADATA_PATH, file), 'utf-8');
        const metadata = JSON.parse(content);
        
        // No need to modify URLs - they're already absolute from Cloudinary
        return metadata;
      } catch (e) {
        console.error(`Error reading metadata file ${file}:`, e);
        return null;
      }
    });
    
    // Wait for all metadata to be read
    const videos = (await Promise.all(videosPromises)).filter(v => v !== null);
    
    // Sort by creation date (newest first)
    return videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error("❌ Error getting local videos:", error);
    return [];
  }
}

export async function GET(req: Request) {
  try {
    console.log(`🌐 GET request for videos`);
    
    // Try fetching from backend first
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/final-videos`);
      console.log("✅ Successfully fetched videos from backend");
      return NextResponse.json(res.data);
    } catch (backendError: any) {
      console.warn("⚠️ Backend unreachable, falling back to local videos:", backendError.message);
      
      // Get local videos as fallback
      const localVideos = await getLocalVideos();
      console.log(`🎬 Found ${localVideos.length} local videos`);
      
      // Return local videos
      return NextResponse.json(localVideos);
    }
  } catch (error: any) {
    console.error("❌ Error in GET request:", error.message);
    return NextResponse.json(
      {
        error: "Failed to fetch videos",
        details: error.message
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    console.log("📥 Received video upload request");
    
    // For multipart form data, we need to handle it differently
    const formData = await req.formData();
    console.log("📋 Form data parsed, fields:", Array.from(formData.keys()));
    
    // Extract metadata
    const userId = formData.get('userId') as string;
    const location = formData.get('location') as string;
    const severity = Number(formData.get('severity') as string);
    const framesSent = Number(formData.get('framesSent') as string);
    
    // Get video blob
    const videoFile = formData.get('video') as File;
    
    if (!videoFile) {
      console.error("❌ No video file in request");
      return NextResponse.json({ error: "No video file provided" }, { status: 400 });
    }
    
    console.log(`📹 Video file received:
      - Name: ${videoFile.name}
      - Size: ${Math.round(videoFile.size / 1024)}KB
      - Type: ${videoFile.type}
    `);
    
    // Convert file to buffer for Cloudinary upload
    const fileBuffer = Buffer.from(await videoFile.arrayBuffer());
    const uniqueId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Also save a local backup copy
    try {
      await mkdir(UPLOADS_PATH, { recursive: true });
      const localFilename = `video_${userId || 'unknown'}_${uniqueId}.webm`;
      const localFilepath = join(UPLOADS_PATH, localFilename);
      await writeFile(localFilepath, fileBuffer);
      console.log(`💾 Backup video saved locally at ${localFilepath}`);
    } catch (localSaveError) {
      console.warn("⚠️ Could not save local backup copy:", localSaveError);
      // Continue anyway - we'll upload to cloud
    }
    
    console.log("☁️ Uploading to Cloudinary...");
    
    try {
      // Upload to Cloudinary
      const uploadResult = await uploadToCloudinary(fileBuffer, {
        resource_type: "video",
        folder: "nirbhaya-astra/videos",
        public_id: `video_${userId || 'unknown'}_${uniqueId}`,
        overwrite: true,
        tags: ["nirbhaya-astra", `user:${userId || 'unknown'}`, `severity:${severity}`],
        context: {
          location: location || 'unknown',
          severity: severity || 5,
          userId: userId || 'unknown',
          framesSent: framesSent || 0,
          timestamp: timestamp
        }
      });
      
      console.log(`☁️ Cloudinary upload successful:
        - URL: ${uploadResult.secure_url}
        - Public ID: ${uploadResult.public_id}
        - Size: ${Math.round(uploadResult.bytes / 1024)}KB
      `);
      
      // Create metadata object with Cloudinary URL
      const metadata = {
        id: uniqueId,
        userId: userId || 'unknown',
        videoUrl: uploadResult.secure_url, // Use the Cloudinary URL (accessible from anywhere)
        cloudinaryPublicId: uploadResult.public_id,
        location: location || 'unknown',
        severity: severity || 5,
        framesSent: framesSent || 0,
        createdAt: timestamp,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        duration: uploadResult.duration
      };
      
      // Save metadata locally
      await saveMetadata(metadata);
      
      try {
        // Now send to backend
        console.log("🔄 Forwarding video metadata to backend server...");
        
        const axiosResponse = await axios.post(
          `http://127.0.0.1:8000/api/final-videos`, 
          {
            videoUrl: uploadResult.secure_url,
            userId: userId || '',
            location: location || '',
            severity: severity || 5,
            framesSent: framesSent || 0,
            cloudinaryPublicId: uploadResult.public_id,
            duration: uploadResult.duration
          },
          { timeout: 10000 }
        );
        
        console.log("✅ Backend server accepted the video metadata");
        
        return NextResponse.json({
          success: true,
          message: "Video uploaded successfully to cloud and backend",
          id: uniqueId,
          videoUrl: uploadResult.secure_url,
          createdAt: timestamp,
          backendResponse: axiosResponse.data
        }, { status: 201 });
        
      } catch (backendError: any) {
        console.error("⚠️ Backend upload failed:", backendError.message);
        
        // Return success anyway since we uploaded to Cloudinary
        return NextResponse.json({
          success: true,
          id: uniqueId,
          videoUrl: uploadResult.secure_url,
          warning: "Video uploaded to cloud but backend is unreachable",
          createdAt: timestamp,
          error: backendError.message
        }, { status: 200 });
      }
    } catch (cloudinaryError: any) {
      console.error("☁️ Cloudinary upload failed:", cloudinaryError);
      
      // Return error response
      return NextResponse.json({
        error: "Failed to upload video to cloud hosting",
        details: cloudinaryError.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error("❌ Fatal error processing video:", error);
    
    return NextResponse.json({
      error: "Failed to process video upload",
      details: error.message
    }, { status: 500 });
  }
}