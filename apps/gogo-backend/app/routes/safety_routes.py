# backend/app/routes/safety_routes.py

from flask import Blueprint, make_response, request, jsonify, current_app
from ..services.gemini_service import GeminiService
from ..models import db, Alert, Route  # Add Route import here
from datetime import datetime
import re
import traceback
import logging
from typing import Dict, Any
import uuid
from flask_cors import cross_origin, CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Define allowed origins
ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001','*']

# Configure CORS for the blueprint
safety_bp = Blueprint('safety', __name__)
CORS(safety_bp, resources={
    r"/*": {
        "origins": ALLOWED_ORIGINS,
        "methods": ["GET", "POST", "PUT", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})

def get_gemini_service():
    if not hasattr(current_app, 'gemini_service'):
        raise RuntimeError("Gemini service not initialized")
    return current_app.gemini_service

def parse_distance(distance_str: str) -> float:
    """Parse distance string to float value."""
    logger.debug(f"Parsing distance string: {distance_str}")
    try:
        distance_match = re.search(r'[\d.]+', str(distance_str))
        if not distance_match:
            logger.warning(f"No numeric value found in distance string: {distance_str}")
            return 0.0
        value = float(distance_match.group())
        logger.debug(f"Successfully parsed distance: {value}")
        return value
    except (ValueError, TypeError) as e:
        logger.error(f"Error parsing distance: {str(e)}")
        return 0.0

def prepare_route_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare route data for analysis."""
    logger.info("Preparing route data for analysis")
    try:
        route_data = {
            'start_location': str(data['start_location']),
            'end_location': str(data['end_location']),
            'current_time': datetime.now().isoformat(),
            'distance': str(data.get('distance', '0')),
            'time_of_day': datetime.now().strftime('%H:%M'),
            'weather': str(data.get('weather', 'Unknown'))
        }
        logger.debug(f"Prepared route data: {route_data}")
        return route_data
    except Exception as e:
        logger.error(f"Error preparing route data: {str(e)}")
        raise

# Helper function to add CORS headers
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin in ALLOWED_ORIGINS:
        response.headers.add('Access-Control-Allow-Origin', origin)
    else:
        response.headers.add('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0])
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response

@safety_bp.route('/analyze-route', methods=['POST', 'OPTIONS'])
def analyze_route():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        return add_cors_headers(response)
    
    try:
        data = request.get_json()
        route_data = prepare_route_data(data)
        
        # Get Gemini service from app context
        gemini_service = get_gemini_service()
        analysis = gemini_service.analyze_route(route_data)
         
        response = jsonify({
            'status': 'success',
            'data': {
                'analysis': {
                    'safety_score': analysis.get('safety_score', 70),
                    'risk_level': analysis.get('risk_level', 'medium'),
                    'primary_concerns': analysis.get('primary_concerns', []),
                    'recommendations': analysis.get('recommendations', []),
                    'safe_spots': analysis.get('safe_spots', []),
                    'emergency_resources': analysis.get('emergency_resources', []),
                    'safer_alternatives': analysis.get('safer_alternatives', []),
                    'confidence_score': analysis.get('confidence_score', 0.8)
                },
                'route_id': 1
            }
        })
        
        return add_cors_headers(response)
        
    except Exception as e:
        logger.error(f"Route analysis error: {str(e)}")
        response = jsonify({
            'status': 'error',
            'error': str(e)
        })
        return add_cors_headers(response), 500

@safety_bp.route('/active-route/<int:route_id>', methods=['GET', 'PUT', 'OPTIONS'])
def active_route(route_id):
    """Get or update active route information."""
    request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')
    logger.info(f"[RequestID: {request_id}] Active route request for route_id: {route_id}")

    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        return add_cors_headers(response)

    try:
        route = Route.query.get_or_404(route_id)
        logger.debug(f"[RequestID: {request_id}] Found route: {route_id}")
        
        if request.method == 'GET':
            logger.info(f"[RequestID: {request_id}] Retrieving route information")
            response = jsonify({
                'status': 'success',
                'data': {
                    'id': route.id,
                    'start_location': route.start_location,
                    'end_location': route.end_location,
                    'start_time': route.start_time.isoformat(),
                    'safety_score': route.safety_score,
                    'status': route.status
                }
            })
            logger.debug(f"[RequestID: {request_id}] Returning route data")
            return add_cors_headers(response)
        
        else:  # PUT
            logger.info(f"[RequestID: {request_id}] Updating route status")
            data = request.get_json()
            logger.debug(f"[RequestID: {request_id}] Update data: {data}")
            
            route.status = data.get('status', route.status)
            if data.get('status') == 'completed':
                route.end_time = datetime.now()
                logger.info(f"[RequestID: {request_id}] Marking route as completed")
            
            db.session.commit()
            logger.info(f"[RequestID: {request_id}] Successfully updated route")
            response = jsonify({
                'status': 'success',
                'message': 'Route updated successfully'
            })
            return add_cors_headers(response)
            
    except Exception as e:
        logger.error(f"[RequestID: {request_id}] Error handling route request: {str(e)}\n{traceback.format_exc()}")
        response = jsonify({
            'status': 'error',
            'error': str(e)
        })
        return add_cors_headers(response), 500

@safety_bp.route('/analyze-area', methods=['POST', 'OPTIONS'])
def analyze_area():
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        return add_cors_headers(response)
    
    try:
        logger.info("Analyze area request received")
        data = request.get_json()
        if not data or 'location' not in data:
            logger.error("Missing location data in request")
            response = jsonify({
                'status': 'error',
                'error': 'Location data required'
            })
            return add_cors_headers(response), 400

        # Get Gemini service from app context
        gemini_service = get_gemini_service()
        if not gemini_service:
            logger.error("Gemini service not initialized")
            response = jsonify({
                'status': 'error',
                'error': 'Service unavailable'
            })
            return add_cors_headers(response), 503

        logger.info(f"Analyzing area for location: {data['location']}")
        analysis = gemini_service.analyze_area(data['location'])

        logger.info("Analysis completed successfully")
        response = jsonify({
            'status': 'success',
            'data': analysis
        })
        return add_cors_headers(response)
        
    except Exception as e:
        logger.error(f"Error analyzing area: {str(e)}", exc_info=True)
        response = jsonify({
            'status': 'error',
            'error': 'Internal server error occurred'
        })
        return add_cors_headers(response), 500
    
@safety_bp.route('/route-history', methods=['GET', 'OPTIONS'])
def route_history():
    """Get route history."""
    request_id = datetime.now().strftime('%Y%m%d%H%M%S%f')
    logger.info(f"[RequestID: {request_id}] Route history request received")

    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = make_response()
        return add_cors_headers(response)
        
    try:
        logger.info(f"[RequestID: {request_id}] Fetching route history")
        routes = Route.query.order_by(Route.created_at.desc()).limit(10).all()
        logger.debug(f"[RequestID: {request_id}] Found {len(routes)} routes")
        
        response = jsonify({
            'status': 'success',
            'data': {
                'routes': [{
                    'id': route.id,
                    'start_location': route.start_location,
                    'end_location': route.end_location,
                    'start_time': route.start_time.isoformat(),
                    'end_time': route.end_time.isoformat() if route.end_time else None,
                    'safety_score': route.safety_score,
                    'status': route.status
                } for route in routes]
            }
        })
        logger.info(f"[RequestID: {request_id}] Successfully retrieved route history")
        return add_cors_headers(response)
        
    except Exception as e:
        logger.error(f"[RequestID: {request_id}] Error fetching route history: {str(e)}\n{traceback.format_exc()}")
        response = jsonify({
            'status': 'error',
            'error': str(e)
        })
        return add_cors_headers(response), 500