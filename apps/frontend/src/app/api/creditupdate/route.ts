import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

// Add a GET method for testing
export async function GET() {
  console.log('Credit update API - GET method called');
  return NextResponse.json({ 
    message: 'Credit update API is working',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  console.log('=== Credit Update API Called ===');
  console.log('URL:', request.url);
  console.log('Method:', request.method);
  
  try {
    const body = await request.json();
    console.log('Request body:', body);
    
    const { videoId, userId, action, severity } = body;

    // Validate required fields
    if (!videoId || !userId || !action) {
      console.log('Validation failed: Missing required fields');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: videoId, userId, action' 
        },
        { status: 400 }
      );
    }

    // Validate action type
    if (action !== 'valid' && action !== 'false') {
      console.log('Validation failed: Invalid action type');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid action. Must be "valid" or "false"' 
        },
        { status: 400 }
      );
    }

    // Validate severity for valid cases
    if (action === 'valid' && (!severity || severity < 1 || severity > 10)) {
      console.log('Validation failed: Invalid severity');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid severity. Must be between 1 and 10 for valid cases' 
        },
        { status: 400 }
      );
    }

    console.log('Validation passed, forwarding to Python backend...');
    
    try {
      // Forward the request to Python backend
      const backendResponse = await axios.post(
        'http://127.0.0.1:8000/api/credit-update',
        {
          videoId,
          userId,
          action,
          severity
        },
        { 
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Backend response:', backendResponse.data);
      
      return NextResponse.json(backendResponse.data, { 
        status: backendResponse.status 
      });
      
    } catch (backendError: any) {
      console.error('❌ Backend request failed:', backendError.message);
      
      if (backendError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Backend server is not running',
            details: 'Python FastAPI server is not accessible on port 8000'
          },
          { status: 503 }
        );
      }
      
      if (backendError.response) {
        console.error('Backend error response:', backendError.response.data);
        return NextResponse.json(
          backendError.response.data,
          { status: backendError.response.status }
        );
      }
      
      if (backendError.code === 'ENOTFOUND') {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Cannot connect to backend server',
            details: 'Check if Python server is running on localhost:8000'
          },
          { status: 503 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to communicate with backend server',
          details: backendError.message
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('=== API Error ===');
    console.error('Error details:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error in credit update API',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST.' },
    { status: 405 }
  );
}