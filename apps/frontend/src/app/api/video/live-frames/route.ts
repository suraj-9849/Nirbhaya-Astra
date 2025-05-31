import axios from "axios";
import { NextResponse } from "next/server";
import { writeFile, mkdir, readdir, readFile } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import { existsSync } from "fs";
import { UploadApiResponse, v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "diypfqcmd",
  api_key: process.env.CLOUDINARY_API_KEY || "966199493542533",
  api_secret: process.env.CLOUDINARY_API_SECRET || "HyBhlPX-HLvRhyiWnoEH5UXdnDc",
  secure: true
});

// Define path for metadata storage
const FRAMES_METADATA_PATH = join(process.cwd(), 'public', 'uploads', 'frames-metadata');

// Function to upload base64 image to Cloudinary
async function uploadBase64ToCloudinary(base64Image: string, options: any): Promise<UploadApiResponse> {
  // Remove data URL prefix if present
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      `data:image/jpeg;base64,${base64Data}`,
      options,
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          return reject(error);
        }
        resolve(result as UploadApiResponse);
      }
    );
  });
}

// Function to save frame metadata
async function saveFrameMetadata(metadata: any) {
  try {
    // Ensure metadata directory exists
    await mkdir(FRAMES_METADATA_PATH, { recursive: true });
    
    // Save metadata to JSON file
    const metadataPath = join(FRAMES_METADATA_PATH, `${metadata.id}.json`);
    await writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    return true;
  } catch (error) {
    console.error("❌ Error saving frame metadata:", error);
    return false;
  }
}

// Function to read local frames metadata
async function getLocalFrames(): Promise<any[]> {
  try {
    // Ensure metadata directory exists
    if (!existsSync(FRAMES_METADATA_PATH)) {
      await mkdir(FRAMES_METADATA_PATH, { recursive: true });
      return [];
    }
    
    // Read metadata directory
    const files = await readdir(FRAMES_METADATA_PATH);
    const metadataFiles = files.filter(file => file.endsWith('.json'));
    
    // Read each metadata file
    const framesPromises = metadataFiles.map(async (file) => {
      try {
        const content = await readFile(join(FRAMES_METADATA_PATH, file), 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.error(`Error reading frame metadata file ${file}:`, e);
        return null;
      }
    });
    
    // Wait for all metadata to be read
    const frames = (await Promise.all(framesPromises)).filter(f => f !== null);
    
    // Sort by timestamp (newest first)
    return frames.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.error("❌ Error getting local frames:", error);
    return [];
  }
}

export async function GET(req: Request) {
  try {
    console.log("📋 GET request for live frames");
    
    // Try fetching from backend first
    try {
      const res = await axios.get(`http://127.0.0.1:8000/api/live-frames`);
      console.log("✅ Successfully fetched frames from backend");
      return NextResponse.json(res.data);
    } catch (error: any) {
      console.warn("⚠️ Backend unreachable, falling back to local frames:", error.message);

      // Get local frames as fallback
      const localFrames = await getLocalFrames();
      console.log(`🖼️ Found ${localFrames.length} local frames`);
      
      // Return local frames
      return NextResponse.json(localFrames);
    }
  } catch (error: any) {
    console.error("Error fetching live frames:", error.message);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Log receipt of the request
    console.log("📥 Received frame capture request");
    
    // Parse the request body
    const body = await req.json();
    
    // Log frame details before processing
    console.log(`🖼️ Frame details:
      - User ID: ${body.userId}
      - Location: ${body.location ? body.location.substring(0, 30) + '...' : 'N/A'}
      - Severity: ${body.severity}
      - Timestamp: ${body.timestamp}
      - Frame data exists: ${!!body.frame}
      - Frame type: ${body.frame ? (body.frame.startsWith('data:') ? 'base64' : 'other') : 'none'}
    `);
    
    // Check if we have a frame image
    if (!body.frame) {
      console.error("❌ No frame data provided");
      return NextResponse.json({
        error: "No frame data provided"
      }, { status: 400 });
    }
    
    // Validate that the frame is base64 data
    if (!body.frame.startsWith('data:image')) {
      console.error("❌ Invalid frame format - must be base64 data URL");
      return NextResponse.json({
        error: "Invalid frame format - must be base64 data URL"
      }, { status: 400 });
    }
    
    // Generate a unique ID for this frame
    const frameId = uuidv4();
    const timestamp = body.timestamp || new Date().toISOString();
    
    try {
      // Upload frame to Cloudinary
      console.log("☁️ Uploading frame to Cloudinary...");
      
      const uploadResult = await uploadBase64ToCloudinary(body.frame, {
        resource_type: "image",
        folder: "nirbhaya-astra/frames",
        public_id: `frame_${body.userId || 'unknown'}_${frameId}`,
        overwrite: true,
        tags: ["nirbhaya-astra", "frame", `user:${body.userId || 'unknown'}`, `severity:${body.severity}`],
        context: {
          location: body.location || 'unknown',
          severity: body.severity || 0,
          userId: body.userId || 'unknown',
          timestamp: timestamp
        },
        transformation: [
          { quality: "auto", fetch_format: "auto" }, // Optimize quality and format
          { width: 800, height: 600, crop: "limit" } // Limit max size
        ]
      });
      
      console.log(`☁️ Frame uploaded to Cloudinary successfully:
        - URL: ${uploadResult.secure_url}
        - Public ID: ${uploadResult.public_id}
        - Size: ${Math.round(uploadResult.bytes / 1024)}KB
        - Format: ${uploadResult.format}
        - Dimensions: ${uploadResult.width}x${uploadResult.height}
      `);
      
      // Create metadata with Cloudinary URL
      const frameMetadata = {
        id: frameId,
        userId: body.userId,
        frame: uploadResult.secure_url, // Store the Cloudinary URL instead of base64
        cloudinaryPublicId: uploadResult.public_id,
        location: body.location,
        severity: body.severity,
        timestamp: timestamp,
        width: uploadResult.width,
        height: uploadResult.height,
        format: uploadResult.format,
        bytes: uploadResult.bytes
      };
      
      // Save metadata locally as backup
      await saveFrameMetadata(frameMetadata);
      
      // Prepare data for backend with Cloudinary URL
      const backendData = {
        ...body,
        frame: uploadResult.secure_url, // Replace base64 with Cloudinary URL
        cloudinaryPublicId: uploadResult.public_id
      };
      
      // Send to your backend API
      try {
        console.log("🚀 Sending frame metadata to backend API...");
        const res = await axios.post(`http://127.0.0.1:8000/api/live-frames`, backendData);
        
        console.log("✅ Frame successfully sent to backend");
        return NextResponse.json({
          ...res.data,
          cloudinaryUrl: uploadResult.secure_url,
          id: frameId
        }, { status: 201 });
      } catch (backendError: any) {
        console.warn("⚠️ Backend unreachable, but frame is saved to Cloudinary:", backendError.message);
        
        // Return success with the Cloudinary data even if backend fails
        return NextResponse.json({
          success: true,
          id: frameId,
          frame: uploadResult.secure_url,
          cloudinaryPublicId: uploadResult.public_id,
          warning: "Backend unavailable, frame saved to cloud storage",
          timestamp: timestamp
        }, { status: 200 });
      }
    } catch (cloudinaryError: any) {
      console.error("☁️ Error uploading to Cloudinary:", cloudinaryError);
      
      // Try to send the original frame to backend anyway as fallback
      try {
        console.log("🚀 Attempting to send original frame to backend as fallback...");
        const res = await axios.post(`http://127.0.0.1:8000/api/live-frames`, body);
        
        console.log("✅ Original frame sent to backend despite Cloudinary failure");
        return NextResponse.json({
          ...res.data,
          warning: "Cloudinary upload failed, using original data"
        }, { status: 201 });
      } catch (backendError: any) {
        console.error("❌ Both Cloudinary and backend failed:", backendError.message);
        
        // Both failed, save locally as last resort
        try {
          const frameMetadata = {
            id: frameId,
            userId: body.userId,
            frame: body.frame, // Keep the original base64 data
            location: body.location,
            severity: body.severity,
            timestamp: timestamp,
            cloudinaryError: cloudinaryError.message,
            backendError: backendError.message
          };
          
          await saveFrameMetadata(frameMetadata);
          
          return NextResponse.json({
            success: true,
            warning: "Frame saved locally only (cloud and backend failed)",
            timestamp: timestamp,
            id: frameId,
            errors: {
              cloudinary: cloudinaryError.message,
              backend: backendError.message
            }
          }, { status: 200 });
        } catch (localError) {
          console.error("❌ All storage methods failed:", localError);
          
          return NextResponse.json({
            error: "Failed to store frame (all methods failed)",
            details: {
              cloudinary: cloudinaryError.message,
              backend: backendError.message,
              local: (localError && typeof localError === "object" && "message" in localError) ? (localError as any).message : String(localError)
            }
          }, { status: 500 });
        }
      }
    }
  } catch (error: any) {
    console.error("❌ Error processing live frame:", error.message);
    
    return NextResponse.json({
      error: "Failed to process live frame",
      details: error.message
    }, { status: 500 });
  }
}