# Built-in libraries
import base64
import json
import logging
import os
import io
import random
from datetime import datetime

# External dependencies
from bson import ObjectId
from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import google.generativeai as genai
from PIL import Image
import requests
from pydantic import BaseModel
from typing import Optional, List
from uuid import uuid4

from backend.db import get_database, upload_embeddings_to_mongo
from backend.logger import CustomFormatter
from backend.schema import FileContent, PostInfo
from backend.utils.common import (load_image_from_url_or_file,
                                  read_files_from_directory,
                                  serialize_object_id)
from backend.utils.embedding import find_top_matches, generate_text_embedding
from backend.utils.regex_ptr import extract_info
from backend.utils.steganography import (decode_text_from_image,
                                         encode_text_in_image)
from backend.utils.text_llm import (create_poem, decompose_user_text,
                                    expand_user_text_using_gemini,
                                    text_to_image)
from backend.utils.twitter import send_message_to_twitter
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(CustomFormatter())
logger.addHandler(handler)

# Cached database connection
db = None

# Initialize FastAPI and CORS middleware
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def initialize_database():
    global db
    if db is None:
        try:
            db = get_database()
            # Just list the collection names as a simple connection test
            _ = db.list_collection_names()
            logger.info("Database connection established successfully")
        except Exception as e:
            logger.error(f"Error connecting to database: {str(e)}")
            db = None

# Call the initialize function at startup
@app.on_event("startup")
async def startup_event():
    initialize_database()

@app.get("/")
async def root():
    return {"message": "Welcome to Haven Backend API"}

# Setup Gemini API
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    logger.warning("GEMINI_API_KEY not found! Please check your .env file.")
else:
    genai.configure(api_key=GEMINI_API_KEY)

# Setup Unsplash API
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
if not UNSPLASH_ACCESS_KEY:
    logger.warning("UNSPLASH_ACCESS_KEY not found! Please check your .env file.")

# Define Pydantic models
class LiveFrameBase(BaseModel):
    userId: str
    frame: str  # base64 string or URL
    location: str
    severity: int

class LiveFrame(LiveFrameBase):
    id: Optional[str] = None
    timestamp: Optional[datetime] = None

class FinalVideoBase(BaseModel):
    userId: str
    videoUrl: str
    location: str
    severity: int

class FinalVideo(FinalVideoBase):
    id: Optional[str] = None
    createdAt: Optional[datetime] = None
    isVerified: Optional[bool] = False  # Add this field
    verifiedAt: Optional[datetime] = None  # Add this field
    framesSent: Optional[int] = 0  # Add this field
    cloudinaryPublicId: Optional[str] = None  # Add this field
    duration: Optional[float] = None  # Add this field
    status: Optional[str] = "active"  # Add this field

class CreditUpdateRequest(BaseModel):
    videoId: str
    userId: str
    action: str
    severity: Optional[int] = None

class CreditUpdateResponse(BaseModel):
    success: bool
    action: str
    message: str  # Make this required
    creditsAwarded: Optional[int] = None
    newCreditTotal: Optional[int] = None
    itemsRemoved: Optional[dict] = None
    userId: Optional[str] = None

# API Endpoints
@app.post("/text-generation")
async def get_post_and_expand_its_content(post_info: PostInfo):
    """Expand user input text for help message generation using only Gemini."""
    try:
        concatenated_text = (
            f"Name: {post_info.name}\n"
            f"Phone: {post_info.phone}\n"
            f"Location: {post_info.location}\n"
            f"Duration of Abuse: {post_info.duration_of_abuse}\n"
            f"Frequency of Incidents: {post_info.frequency_of_incidents}\n"
            f"Preferred Contact Method: {post_info.preferred_contact_method}\n"
            f"Current Situation: {post_info.current_situation}\n"
            f"Culprit Description: {post_info.culprit_description}\n"
            f"Custom Text: {post_info.custom_text}\n"
        )
        gemini_response = await expand_user_text_using_gemini(concatenated_text)
        return {"gemini_response": gemini_response}
    except Exception as e:
        logger.error(f"Error expanding text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error expanding text: {str(e)}")

@app.post("/img-generation")
async def create_image_from_prompt(input_data: str):
    """Generate an image based on a text prompt."""
    try:
        text_to_image(input_data)
        return {"received_text": input_data}
    except Exception as e:
        logger.error(f"Error generating image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating image: {str(e)}")


@app.post("/text-decomposition")
async def decompose_text_content(data: dict):
    """Decompose and extract information from user text."""
    try:
        text = data.get("text")
        decomposed_text = decompose_user_text(text)
        return {"extracted_data": extract_info(decomposed_text)}
    except Exception as e:
        logger.error(f"Error decomposing text: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error decomposing text: {str(e)}")


@app.post("/save-extracted-data")
async def save_extracted_data(data: dict):
    try:
        # Ensure database is connected
        global db
        if db is None:
            initialize_database()
            if db is None:  # If still None after initialization
                raise Exception("Failed to connect to database")
                
        db["admin"].insert_one(data)
        return {"status": "Data saved successfully"}
    except Exception as e:
        logger.error(f"Error saving data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error saving data: {str(e)}")


@app.post("/encode")
async def encode_text_in_image_endpoint(
    text: str, img_url: str = None, file: UploadFile = File(None)
):
    """Encode text into an image."""
    try:
        image = load_image_from_url_or_file(img_url, file)
        encoded_image = encode_text_in_image(image, text)
        output_path = "encoded_image.png"
        encoded_image.save(output_path, format="PNG")
        return StreamingResponse(
            open(output_path, "rb"),
            media_type="image/png",
            headers={"Content-Disposition": "attachment; filename=encoded_image.png"},
        )
    except Exception as e:
        logger.error(f"Error encoding text in image: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error encoding text in image: {str(e)}"
        )


@app.post("/decode")
async def decode_text_from_image_endpoint(
    img_url: str = None, file: UploadFile = File(None)
):
    """Decode text from an image."""
    try:
        image = load_image_from_url_or_file(img_url, file)
        return {"decoded_text": decode_text_from_image(image)}
    except Exception as e:
        logger.error(f"Error decoding text from image: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error decoding text from image: {str(e)}"
        )


@app.get("/poem-generation")
async def create_poem_endpoint(text: str):
    """Generate an inspirational poem based on input text."""
    try:
        return {"poem": create_poem(text)}
    except Exception as e:
        logger.error(f"Error generating poem: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating poem: {str(e)}")


@app.post("/send-message")
async def send_message_to_twitter_endpoint(image_url: str, caption: str):
    """Send a message to Twitter."""
    try:
        send_message_to_twitter(image_url, caption)
        return {"status": "Message sent successfully"}
    except Exception as e:
        logger.error(f"Error sending message to Twitter: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error sending message to Twitter: {str(e)}"
        )


@app.get("/get-admin-posts")
def get_all_posts():
    """Retrieve all posts from the database."""
    try:
        logger.info("Attempting to retrieve posts from admin collection")
        
        # Ensure database is connected
        global db
        if db is None:
            logger.info("Database connection not initialized, initializing now")
            initialize_database()
            if db is None:  # If still None after initialization
                raise Exception("Failed to connect to database")
        
        # Check if collection exists
        collection_names = db.list_collection_names()
        if "admin" not in collection_names:
            logger.warning("Admin collection not found. Available collections: %s", collection_names)
            return JSONResponse(content=[])  # Return empty array if collection doesn't exist
        
        # Get posts from collection
        posts = []
        try:
            cursor = db["admin"].find()
            posts = [serialize_object_id(post) for post in cursor]
            logger.info(f"Successfully retrieved {len(posts)} posts")
        except Exception as e:
            logger.error(f"Error querying admin collection: {str(e)}")
            raise e
            
        return JSONResponse(content=posts)
    except Exception as e:
        logger.error(f"Error retrieving posts: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving posts: {str(e)}")


@app.get("/find-match")
def find_top_matching_posts(info: str, collection: str):
    """Find top matches based on embedding similarity."""
    try:
        # Ensure database is connected
        global db
        if db is None:
            initialize_database()
            if db is None:  # If still None after initialization
                raise Exception("Failed to connect to database")
                
        description_vector = generate_text_embedding(info)
        top_matches = find_top_matches(db[collection], description_vector)
        return [serialize_object_id(match) for match in top_matches]
    except Exception as e:
        logger.error(f"Error finding matches: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error finding matches: {str(e)}")


@app.get("/get-post/{post_id}")
def get_post_by_id(post_id: str):
    """Retrieve a specific post by its ID."""
    try:
        # Ensure database is connected
        global db
        if db is None:
            initialize_database()
            if db is None:  # If still None after initialization
                raise Exception("Failed to connect to database")
                
        post = db["admin"].find_one({"_id": ObjectId(post_id)})
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        return JSONResponse(content=serialize_object_id(post))
    except Exception as e:
        logger.error(f"Error retrieving post by ID: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving post by ID: {str(e)}")

@app.post("/close-issue/{issue_id}")
async def close_issue(issue_id: str):
    """Mark an issue as closed by updating its status."""
    try:
        # Ensure database is connected
        global db
        if db is None:
            initialize_database()
            if db is None:  # If still None after initialization
                raise Exception("Failed to connect to database")
                
        result = db["admin"].update_one(
            {"_id": ObjectId(issue_id)},
            {"$set": {"status": "closed"}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Issue not found or already closed")
        return {"status": "Issue marked as closed"}
    except Exception as e:
        logger.error(f"Error closing issue: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error closing issue: {str(e)}")

@app.post("/upload_embeddings/")
async def upload_embeddings():
    """Upload embeddings to MongoDB."""
    try:
        # Ensure database is connected
        global db
        if db is None:
            initialize_database()
            if db is None:  # If still None after initialization
                raise Exception("Failed to connect to database")
                
        file_contents = read_files_from_directory("backend/docs")
        upload_embeddings_to_mongo(file_contents)
        return {"message": "Embeddings uploaded successfully"}
    except Exception as e:
        logger.error(f"Error uploading embeddings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error uploading embeddings: {str(e)}")
        
@app.post("/generate-image")
async def generate_image(data: dict):
    """Get relevant images from Unsplash based on a text prompt."""
    try:
        prompt = data.get("prompt")
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt is required")

        logger.info(f"Searching Unsplash for images with query: {prompt}")

        per_page = 3
        headers = {
            "Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"
        }
        params = {
            "query": prompt,
            "per_page": per_page,
            "orientation": "landscape"
        }
        
        response = requests.get("https://api.unsplash.com/search/photos", params=params, headers=headers)

        if response.status_code != 200:
            logger.error(f"Unsplash API returned {response.status_code}: {response.text}")
            raise HTTPException(status_code=response.status_code, detail="Unsplash API error")

        results = response.json().get("results", [])
        image_urls = [r["urls"]["regular"] for r in results if "urls" in r]

        # Fallback to default search if no results
        if not image_urls:
            fallback_term = random.choice(["nature", "landscape", "abstract", "calm"])
            logger.warning(f"No images found for '{prompt}'. Trying fallback with '{fallback_term}'")

            fallback_response = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": fallback_term, "per_page": per_page},
                headers=headers
            )

            if fallback_response.status_code == 200:
                fallback_results = fallback_response.json().get("results", [])
                image_urls = [r["urls"]["regular"] for r in fallback_results if "urls" in r]

        if not image_urls:
            logger.warning("No Unsplash results even after fallback. Using static defaults.")
            image_urls = [
                "https://images.unsplash.com/photo-1506744038136-46273834b3fb",
                "https://images.unsplash.com/photo-1470770841072-f978cf4d019e",
                "https://images.unsplash.com/photo-1601758123927-196d71d6f15e"
            ]

        return {"images": image_urls}

    except Exception as e:
        logger.error(f"Error fetching images: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching images: {str(e)}")

# LiveFrame endpoints
@app.get("/api/live-frames")
async def get_live_frames():
    """Retrieve all live frames from the database, sorted by severity."""
    try:
        # Ensure database is connected
        global db
        if db is None:
            initialize_database()
            if db is None:
                raise Exception("Failed to connect to database")
        
        # Check if collection exists, create if not
        if "liveFrames" not in db.list_collection_names():
            logger.info("Creating liveFrames collection")
            db.create_collection("liveFrames")
        
        # Get frames sorted by severity (highest first)
        frames = list(db["liveFrames"].find().sort("severity", -1))
        return [serialize_object_id(frame) for frame in frames]
    except Exception as e:
        logger.error(f"Error retrieving live frames: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving live frames: {str(e)}")

@app.get("/api/live-frames/{frame_id}")
async def get_live_frame(frame_id: str):
    """Retrieve a specific live frame by ID."""
    try:
        global db
        if db is None:
            initialize_database()
            if db is None:
                raise Exception("Failed to connect to database")
        
        frame = db["liveFrames"].find_one({"_id": ObjectId(frame_id)})
        if not frame:
            raise HTTPException(status_code=404, detail="Frame not found")
        
        return serialize_object_id(frame)
    except Exception as e:
        logger.error(f"Error retrieving frame: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving frame: {str(e)}")

@app.post("/api/live-frames")
async def create_live_frame(frame: LiveFrame):
    """Create a new live frame entry."""
    try:
        global db
        if db is None:
            initialize_database()
            if db is None:
                raise Exception("Failed to connect to database")
        
        # Set defaults if not provided
        frame_dict = frame.dict()
        if not frame.id:
            frame_dict["id"] = str(uuid4())
        if not frame.timestamp:
            frame_dict["timestamp"] = datetime.utcnow()
        
        # Insert into database
        result = db["liveFrames"].insert_one(frame_dict)
        
        # Return created frame with ID
        created_frame = db["liveFrames"].find_one({"_id": result.inserted_id})
        return serialize_object_id(created_frame)
    except Exception as e:
        logger.error(f"Error creating live frame: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating live frame: {str(e)}")

# FinalVideo endpoints
@app.get("/api/final-videos")
async def get_final_videos():
    """Retrieve all final videos from the database, sorted by creation date."""
    try:
        global db
        if db is None:
            initialize_database()
            if db is None:
                raise Exception("Failed to connect to database")
        
        # Check if collection exists, create if not
        collection_names = db.list_collection_names()  # Fix: define collection_names
        if "finalVideos" not in collection_names:
            logger.info("Creating finalVideos collection")
            db.create_collection("finalVideos")
        
        # Get videos sorted by creation date (newest first)
        videos = list(db["finalVideos"].find().sort("createdAt", -1))
        
        # Ensure all videos have verification fields with defaults
        for video in videos:
            if "isVerified" not in video:
                video["isVerified"] = False
            if "verifiedAt" not in video:
                video["verifiedAt"] = None
        
        logger.info(f"Retrieved {len(videos)} videos from database")
        return [serialize_object_id(video) for video in videos]
    except Exception as e:
        logger.error(f"Error retrieving final videos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving final videos: {str(e)}")

@app.get("/api/final-videos/{video_id}")
async def get_final_video(video_id: str):
    """Retrieve a specific final video by ID."""
    try:
        global db
        if db is None:
            initialize_database()
            if db is None:
                raise Exception("Failed to connect to database")
        
        video = db["finalVideos"].find_one({"_id": ObjectId(video_id)})
        if not video:
            raise HTTPException(status_code=404, detail="Video not found")
        
        return serialize_object_id(video)
    except Exception as e:
        logger.error(f"Error retrieving video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving video: {str(e)}")

@app.post("/api/final-videos")
async def create_final_video(
    videoUrl: str = Form(...),
    userId: str = Form(...),
    location: str = Form(...),
    severity: int = Form(...),
    framesSent: Optional[int] = Form(0),
    cloudinaryPublicId: Optional[str] = Form(None),
    duration: Optional[float] = Form(None)
):
    """Create a new final video entry using Cloudinary URL."""
    try:
        logger.info(f"Received final video submission from user {userId}")
        logger.info(f"Video URL: {videoUrl[:50]}...")
        logger.info(f"Location: {location[:30]}...")
        logger.info(f"Severity: {severity}, Frames sent: {framesSent}")
        
        global db
        if db is None:
            initialize_database()
            if db is None:
                raise Exception("Failed to connect to database")
        
        # Create video document with all required fields
        video_dict = {
            "id": str(uuid4()),  # Add custom ID for easier lookup
            "userId": userId,
            "videoUrl": videoUrl,  # This is the Cloudinary URL
            "location": location,
            "severity": severity,
            "framesSent": framesSent,
            "cloudinaryPublicId": cloudinaryPublicId,
            "duration": duration,
            "createdAt": datetime.utcnow(),
            "isVerified": False,  # Ensure this is set
            "verifiedAt": None,   # Ensure this is set
            "status": "active"
        }
        
        # Insert into database
        result = db["finalVideos"].insert_one(video_dict)
        logger.info(f"Video entry saved with ID: {result.inserted_id}")
        
        # Return created video with ID
        created_video = db["finalVideos"].find_one({"_id": result.inserted_id})
        logger.info(f"Created video verification status: {created_video.get('isVerified', 'NOT SET')}")
        
        return serialize_object_id(created_video)
    except Exception as e:
        logger.error(f"Error creating final video: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error creating final video: {str(e)}")

@app.post("/api/credit-update", response_model=CreditUpdateResponse)
async def update_credit(request: CreditUpdateRequest):
    """
    Handle credit updates for video verification
    - Valid cases: increment user credit by severity amount and mark video as verified
    - False cases: delete video and related frames
    """
    logger.info(f"=== Credit Update Request ===")
    logger.info(f"Video ID: {request.videoId}")
    logger.info(f"User ID: {request.userId}")
    logger.info(f"Action: {request.action}")
    logger.info(f"Severity: {request.severity}")
    
    try:
        # Ensure database is connected
        global db
        if db is None:
            initialize_database()
            if db is None:
                raise Exception("Failed to connect to database")

        # Initialize collections if they don't exist
        collection_names = db.list_collection_names()
        if "users" not in collection_names:
            logger.info("Creating users collection")
            db.create_collection("users")
        if "finalVideos" not in collection_names:
            logger.info("Creating finalVideos collection")
            db.create_collection("finalVideos")
        if "liveFrames" not in collection_names:
            logger.info("Creating liveFrames collection")
            db.create_collection("liveFrames")

        # Check if video exists - try multiple approaches
        video = None
        
        # First try to find by custom id field
        video = db["finalVideos"].find_one({"id": request.videoId})
        
        # If not found, try finding by MongoDB ObjectId
        if not video:
            try:
                video = db["finalVideos"].find_one({"_id": ObjectId(request.videoId)})
            except:
                pass
        
        # If still not found, try a more flexible search
        if not video:
            # Try finding by any field that might contain the video ID
            video = db["finalVideos"].find_one({
                "$or": [
                    {"id": request.videoId},
                    {"_id": request.videoId},
                    {"videoId": request.videoId}
                ]
            })
        
        if not video:
            logger.error(f"Video not found with ID: {request.videoId}")
            # List all videos for debugging
            all_videos = list(db["finalVideos"].find({}, {"id": 1, "_id": 1, "videoUrl": 1}))
            logger.info(f"Available videos: {[str(v.get('_id', 'no_id')) + ':' + v.get('id', 'no_custom_id') for v in all_videos]}")
            raise HTTPException(status_code=404, detail="Video not found")
        
        logger.info(f"Video found: {video.get('id', video.get('_id'))}")

        # Check if video is already verified
        if video.get("isVerified", False):
            logger.warning("Video is already verified")
            raise HTTPException(status_code=409, detail="Video is already verified")

        # Check if user exists
        user = db["users"].find_one({"id": request.userId})
        if not user:
            try:
                user = db["users"].find_one({"_id": ObjectId(request.userId)})
            except:
                pass
        
        # If user doesn't exist, create one
        if not user:
            logger.info(f"User not found, creating new user: {request.userId}")
            user_doc = {
                "id": request.userId,
                "credit": 0,
                "createdAt": datetime.utcnow(),
                "isGovtOfficial": False
            }
            result = db["users"].insert_one(user_doc)
            user = db["users"].find_one({"_id": result.inserted_id})
            logger.info(f"Created new user with ID: {result.inserted_id}")

        if request.action == "valid":
            logger.info("Processing valid case...")
            
            if not request.severity or request.severity < 1 or request.severity > 10:
                raise HTTPException(
                    status_code=400, 
                    detail="Invalid severity. Must be between 1 and 10 for valid cases"
                )
            
            try:
                # Update user credit
                current_credit = user.get("credit", 0)
                new_credit = current_credit + request.severity
                
                logger.info(f"Updating user credit: {current_credit} → {new_credit}")
                
                # Update user credit in database
                user_update_result = db["users"].update_one(
                    {"_id": user["_id"]},
                    {
                        "$set": {"credit": new_credit},
                        "$currentDate": {"updatedAt": True}
                    }
                )
                
                if user_update_result.modified_count == 0:
                    raise Exception("Failed to update user credit")

                logger.info(f"Marking video {video['_id']} as verified...")

                # Mark video as verified
                verification_time = datetime.utcnow()
                video_update_result = db["finalVideos"].update_one(
                    {"_id": video["_id"]},
                    {
                        "$set": {
                            "isVerified": True,
                            "verifiedAt": verification_time
                        }
                    }
                )
                
                logger.info(f"Video update result: modified_count = {video_update_result.modified_count}")
                
                if video_update_result.modified_count == 0:
                    raise Exception("Failed to update video verification status")

                # Verify the update worked
                updated_video = db["finalVideos"].find_one({"_id": video["_id"]})
                logger.info(f"Video after update - isVerified: {updated_video.get('isVerified')}, verifiedAt: {updated_video.get('verifiedAt')}")

                logger.info(f"Valid case processed successfully. Credit: {current_credit} → {new_credit}")
                
                return CreditUpdateResponse(
                    success=True,
                    action="credited",
                    creditsAwarded=request.severity,
                    newCreditTotal=new_credit,
                    message=f"User credited with {request.severity} points for valid incident"
                )
                
            except Exception as transaction_error:
                logger.error(f"Transaction failed: {transaction_error}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to process valid case: {str(transaction_error)}"
                )
        
        elif request.action == "false":
            logger.info("Processing false case...")
            
            try:
                # Count frames before deletion
                frame_count = db["liveFrames"].count_documents({"userId": request.userId})
                
                # Delete all live frames for this user
                frames_delete_result = db["liveFrames"].delete_many({"userId": request.userId})
                logger.info(f"Deleted {frames_delete_result.deleted_count} frames")
                
                # Delete the video
                video_delete_result = db["finalVideos"].delete_one({"_id": video["_id"]})
                
                if video_delete_result.deleted_count == 0:
                    raise Exception("Failed to delete video")
                
                logger.info(f"False case processed successfully. Deleted 1 video and {frame_count} frames")
                
                return CreditUpdateResponse(
                    success=True,
                    action="deleted",
                    itemsRemoved={
                        "video": 1,
                        "frames": frame_count
                    },
                    message=f"False case removed. Deleted 1 video(s) and {frame_count} frame(s)",
                    userId=request.userId
                )
                
            except Exception as transaction_error:
                logger.error(f"Transaction failed: {transaction_error}")
                raise HTTPException(
                    status_code=500, 
                    detail=f"Failed to process false case: {str(transaction_error)}"
                )
        
        else:
            raise HTTPException(
                status_code=400, 
                detail="Invalid action. Must be 'valid' or 'false'"
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )