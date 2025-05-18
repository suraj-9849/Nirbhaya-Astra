import os
import google.generativeai as genai
from dotenv import load_dotenv
import requests
import json

from backend.prompts import (INSPIRATION_POEM_PROMPT,
                              USER_POST_TEXT_DECOMPOSITION_PROMPT,
                              USER_POST_TEXT_EXPANSION_PROMPT)

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
unsplash_api_key = os.getenv("UNSPLASH_ACCESS_KEY")

if not api_key:
    print("API key not found! Please check your .env file.")
else:
    print(f"Using API Key: {api_key[:4]}..." if api_key else "API key not found")

async def expand_user_text_using_gemini(user_input):
    """Expand user text using Gemini 1.5 Pro"""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    
    # Use Gemini 1.5 Pro instead of flash for better quality
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(
        f"{USER_POST_TEXT_EXPANSION_PROMPT}. The data is {user_input}"
    )
    print(f"Gemini response generated: {len(response.text)} characters")
    return response.text

def text_to_image(user_input):
    """Generate an image from text using Unsplash API"""
    if not unsplash_api_key:
        print("Unsplash API key not found! Please check your .env file.")
        return None
    
    # Search for relevant images on Unsplash based on the user input
    search_url = "https://api.unsplash.com/search/photos"
    headers = {
        "Authorization": f"Client-ID {unsplash_api_key}"
    }
    params = {
        "query": user_input,
        "per_page": 1,  # Get just one image
        "orientation": "landscape"  # Typical orientation for better display
    }
    
    try:
        response = requests.get(search_url, headers=headers, params=params)
        response.raise_for_status()  # Raise exception for HTTP errors
        
        data = response.json()
        
        if data["results"] and len(data["results"]) > 0:
            # Return the image URL from the response
            image_url = data["results"][0]["urls"]["regular"]
            print(f"Found image from Unsplash: {image_url}")
            return {"image_url": image_url}
        else:
            print("No images found on Unsplash for this query")
            return None
    
    except Exception as e:
        print(f"Error fetching image from Unsplash: {e}")
        return None

def decompose_user_text(user_input):
    """Decompose user text using Gemini 1.5 Pro"""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    print("before decompose: ", user_input)
    
    # Use Gemini 1.5 Pro for better text decomposition
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(
        f"{USER_POST_TEXT_DECOMPOSITION_PROMPT}. The data is {user_input}"
    )
    print("after decompose: ", response.text)
    return response.text

def create_poem(user_input):
    """Create a poem using Gemini 1.5 Pro"""
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    
    # Use Gemini 1.5 Pro for better creative output
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(
        f"{INSPIRATION_POEM_PROMPT}. The data is {user_input}"
    )
    print(f"Generated poem: {len(response.text)} characters")
    return response.text