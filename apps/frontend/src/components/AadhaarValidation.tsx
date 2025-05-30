import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Camera, 
  Shield, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  AlertTriangle,
  UserCheck,
  FileImage,
  Scan,
  Eye
} from 'lucide-react';

// Install these packages:
// npm install tesseract.js jsqr qrcode-reader

// Real Aadhaar validation service using OCR
class AadhaarValidationService {
  // Initialize Tesseract worker
  static async initializeOCR() {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng+hin');
    return worker;
  }

  // Extract text from Aadhaar image using OCR
  static async extractTextFromImage(imageFile: File): Promise<string> {
    try {
      const worker = await this.initializeOCR();
      
      // Convert file to image URL
      const imageUrl = URL.createObjectURL(imageFile);
      
      // Perform OCR
      const { data: { text } } = await worker.recognize(imageUrl);
      
      // Clean up
      await worker.terminate();
      URL.revokeObjectURL(imageUrl);
      
      return text;
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error('Failed to read Aadhaar card. Please ensure the image is clear and well-lit.');
    }
  }

  // Try to decode QR code if present
  static async tryDecodeQR(imageFile: File): Promise<any> {
    try {
      const jsQR = await import('jsqr');
      
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx?.drawImage(img, 0, 0);
          
          const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
          if (imageData) {
            const code = jsQR.default(imageData.data, canvas.width, canvas.height);
            
            if (code) {
              try {
                // Try to parse QR data (usually XML or encoded)
                const qrData = this.parseAadhaarQRData(code.data);
                resolve(qrData);
              } catch (error) {
                reject(new Error('QR code found but data format not recognized'));
              }
            } else {
              reject(new Error('No QR code found'));
            }
          } else {
            reject(new Error('Failed to process image'));
          }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = URL.createObjectURL(imageFile);
      });
    } catch (error) {
      throw new Error('QR code processing not available');
    }
  }

  // Parse Aadhaar QR data (XML format)
  static parseAadhaarQRData(qrData: string): any {
    try {
      // Aadhaar QR codes often contain XML data
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(qrData, 'text/xml');
      
      // Extract data from XML attributes
      const printLetterBarcodeData = xmlDoc.querySelector('PrintLetterBarcodeData');
      if (printLetterBarcodeData) {
        return {
          name: printLetterBarcodeData.getAttribute('name') || '',
          gender: printLetterBarcodeData.getAttribute('gender') || '',
          dob: printLetterBarcodeData.getAttribute('dob') || '',
          co: printLetterBarcodeData.getAttribute('co') || '',
          house: printLetterBarcodeData.getAttribute('house') || '',
          street: printLetterBarcodeData.getAttribute('street') || '',
          loc: printLetterBarcodeData.getAttribute('loc') || '',
          vtc: printLetterBarcodeData.getAttribute('vtc') || '',
          po: printLetterBarcodeData.getAttribute('po') || '',
          dist: printLetterBarcodeData.getAttribute('dist') || '',
          state: printLetterBarcodeData.getAttribute('state') || '',
          pc: printLetterBarcodeData.getAttribute('pc') || '',
          uid: printLetterBarcodeData.getAttribute('uid') || ''
        };
      } else {
        // Try simple key-value parsing
        const lines = qrData.split('\n');
        const data: any = {};
        lines.forEach(line => {
          const [key, value] = line.split(':').map(s => s.trim());
          if (key && value) {
            data[key.toLowerCase()] = value;
          }
        });
        return data;
      }
    } catch (error) {
      throw new Error('Failed to parse QR data');
    }
  }

  // Extract gender from OCR text using NLP patterns
  static extractGenderFromText(text: string): { gender: string | null, confidence: number, method: string } {
    const cleanText = text.toLowerCase().replace(/[^\w\s]/g, ' ');
    
    // Hindi to English gender mapping
    const genderPatterns = {
      female: [
        // English patterns
        /\b(female|woman|girl|lady|mrs|ms|miss)\b/gi,
        /\b(f|fem)\b/gi,
        // Hindi patterns (transliterated)
        /\b(mahila|stri|ladki|kumari|shrimati)\b/gi,
        /\b(औरत|महिला|स्त्री|लड़की|कुमारी|श्रीमती)\b/gi,
        // Pattern around gender field
        /gender\s*[:\-]?\s*(f|female|महिला|औरत)/gi,
        /sex\s*[:\-]?\s*(f|female|महिला|औरत)/gi,
        /लिंग\s*[:\-]?\s*(महिला|औरत|f)/gi
      ],
      male: [
        // English patterns
        /\b(male|man|boy|gentleman|mr|mister)\b/gi,
        /\b(m|mal)\b/gi,
        // Hindi patterns (transliterated)
        /\b(purush|ladka|shri|babu)\b/gi,
        /\b(पुरुष|लड़का|श्री|बाबू|आदमी)\b/gi,
        // Pattern around gender field
        /gender\s*[:\-]?\s*(m|male|पुरुष|आदमी)/gi,
        /sex\s*[:\-]?\s*(m|male|पुरुष|आदमी)/gi,
        /लिंग\s*[:\-]?\s*(पुरुष|आदमी|m)/gi
      ]
    };

    let femaleScore = 0;
    let maleScore = 0;
    let matchDetails = [];

    // Check female patterns
    genderPatterns.female.forEach(pattern => {
      const matches = cleanText.match(pattern);
      if (matches) {
        femaleScore += matches.length * 2; // Higher weight for direct matches
        matchDetails.push(`Female pattern: ${matches.join(', ')}`);
      }
    });

    // Check male patterns  
    genderPatterns.male.forEach(pattern => {
      const matches = cleanText.match(pattern);
      if (matches) {
        maleScore += matches.length * 2;
        matchDetails.push(`Male pattern: ${matches.join(', ')}`);
      }
    });

    // Additional context-based scoring
    if (/\b(daughter|dau|बेटी|पुत्री)\b/gi.test(cleanText)) {
      femaleScore += 3;
      matchDetails.push('Context: daughter/dau found');
    }
    
    if (/\b(son|पुत्र|बेटा)\b/gi.test(cleanText)) {
      maleScore += 3;
      matchDetails.push('Context: son found');
    }

    // Name-based gender inference (Indian names)
    const namePatterns = {
      female: /\b(priya|asha|sita|gita|kavita|sunita|anita|rita|meera|deepika|pooja|neha|riya|shreya|divya|lakshmi|saraswati|durga|radha|kamala|uma|gayatri|indira|sushma|smriti|nirmala|kiran|jyoti|shanti|mukti|shakti|devi|kumari|bai|ben)\b/gi,
      male: /\b(raj|ram|krishna|arjun|vikram|amit|rahul|rohit|sachin|suresh|mahesh|dinesh|rakesh|naresh|anil|sunil|mukesh|ramesh|ajay|vijay|sanjay|manoj|vinod|pramod|ashok|deepak|alok|vivek|nanak|govind|hari|shiva|brahma|vishnu|ganesh|hanuman|kumar|singh|sharma|gupta|agarwal|jain)\b/gi
    };

    const femaleNameMatches = cleanText.match(namePatterns.female);
    const maleNameMatches = cleanText.match(namePatterns.male);
    
    if (femaleNameMatches) {
      femaleScore += femaleNameMatches.length;
      matchDetails.push(`Female name patterns: ${femaleNameMatches.join(', ')}`);
    }
    
    if (maleNameMatches) {
      maleScore += maleNameMatches.length;
      matchDetails.push(`Male name patterns: ${maleNameMatches.join(', ')}`);
    }

    // Determine result
    const totalScore = femaleScore + maleScore;
    const confidence = totalScore > 0 ? Math.max(femaleScore, maleScore) / totalScore : 0;
    
    let gender = null;
    if (femaleScore > maleScore && femaleScore > 0) {
      gender = 'Female';
    } else if (maleScore > femaleScore && maleScore > 0) {
      gender = 'Male';
    }

    console.log('Gender Detection Details:', {
      femaleScore,
      maleScore,
      confidence,
      matchDetails,
      extractedText: cleanText.substring(0, 500) + '...'
    });

    return {
      gender,
      confidence: Math.round(confidence * 100),
      method: 'OCR + NLP Pattern Matching'
    };
  }

  // Main validation function
  static async validateAadhaarCard(imageFile: File): Promise<any> {
    console.log('Starting Aadhaar validation for file:', imageFile.name);
    
    let extractedData: any = {
      name: '',
      gender: null,
      method: '',
      confidence: 0,
      rawText: ''
    };

    // First try QR code extraction (more accurate)
    try {
      console.log('Attempting QR code extraction...');
      const qrData = await this.tryDecodeQR(imageFile);
      
      if (qrData.gender) {
        extractedData.gender = qrData.gender === 'F' || qrData.gender.toLowerCase() === 'female' ? 'Female' : 'Male';
        extractedData.name = qrData.name || '';
        extractedData.method = 'QR Code';
        extractedData.confidence = 95;
        extractedData.qrData = qrData;
        
        console.log('QR extraction successful:', extractedData);
        return extractedData;
      }
    } catch (error: any) {
      console.log('QR extraction failed, falling back to OCR:', (error?.message ? error?.message : error));
    }

    // Fallback to OCR extraction
    try {
      console.log('Performing OCR extraction...');
      const extractedText = await this.extractTextFromImage(imageFile);
      extractedData.rawText = extractedText;
      
      // Extract gender using NLP
      const genderResult = this.extractGenderFromText(extractedText);
      extractedData.gender = genderResult.gender;
      extractedData.confidence = genderResult.confidence;
      extractedData.method = genderResult.method;
      
      // Try to extract name from OCR text
      const nameMatch = extractedText.match(/Name[:\s]+([A-Za-z\s]+)/i) || 
                       extractedText.match(/नाम[:\s]+([A-Za-z\s]+)/i);
      if (nameMatch) {
        extractedData.name = nameMatch[1].trim();
      }
      
      console.log('OCR extraction completed:', extractedData);
      return extractedData;
      
    } catch (ocrError) {
      console.error('OCR extraction failed:', ocrError);
      throw new Error('Failed to read Aadhaar card. Please ensure the image is clear, well-lit, and shows the complete Aadhaar card.');
    }
  }

  // Validate if user is female
  static validateGender(extractedData: any): { isValid: boolean, reason: string } {
    if (!extractedData.gender) {
      return {
        isValid: false,
        reason: 'Could not determine gender from Aadhaar card. Please ensure the image is clear and complete.'
      };
    }

    if (extractedData.confidence < 70) {
      return {
        isValid: false,
        reason: `Gender detection confidence too low (${extractedData.confidence}%). Please upload a clearer image.`
      };
    }

    if (extractedData.gender.toLowerCase() !== 'female') {
      return {
        isValid: false,
        reason: 'SafeRide is exclusively for women. Only female Aadhaar holders can register.'
      };
    }

    return {
      isValid: true,
      reason: 'Gender validation successful!'
    };
  }

  // Store validation in localStorage and cookies
  static storeValidation(userData: any): void {
    const validationData = {
      isValidated: true,
      name: userData.name,
      gender: userData.gender,
      method: userData.method,
      confidence: userData.confidence,
      validated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    };
    
    localStorage.setItem('saferide_validation', JSON.stringify(validationData));
    document.cookie = `saferide_verified=true; path=/; max-age=${30 * 24 * 60 * 60}; secure; samesite=strict`;
  }

  // Check existing validation
  static checkValidation(): any {
    try {
      const stored = localStorage.getItem('saferide_validation');
      if (stored) {
        const validationData = JSON.parse(stored);
        const expiresAt = new Date(validationData.expires_at);
        
        if (expiresAt > new Date()) {
          return validationData;
        } else {
          localStorage.removeItem('saferide_validation');
          document.cookie = 'saferide_verified=; path=/; max-age=0';
        }
      }
      return null;
    } catch (error) {
      console.error('Error checking validation:', error);
      return null;
    }
  }

  // Clear validation
  static clearValidation(): void {
    localStorage.removeItem('saferide_validation');
    document.cookie = 'saferide_verified=; path=/; max-age=0';
  }
}

interface AadhaarValidationProps {
  onValidationSuccess: (userData: any) => void;
  onValidationFailure: (error: string) => void;
}

const AadhaarValidation: React.FC<AadhaarValidationProps> = ({
  onValidationSuccess,
  onValidationFailure
}) => {
  const [isValidating, setIsValidating] = useState(false);
  const [validationStep, setValidationStep] = useState<'upload' | 'processing' | 'result'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          setError('Image file too large. Please select an image under 10MB.');
          return;
        }
        setSelectedFile(file);
        setError(null);
      } else {
        setError('Please select a valid image file (JPG, PNG, etc.)');
      }
    }
  };

  // Process Aadhaar card
  const processAadhaarCard = async () => {
    if (!selectedFile) {
      setError('Please select an Aadhaar card image first');
      return;
    }

    setIsValidating(true);
    setValidationStep('processing');
    setError(null);

    try {
      // Extract data from Aadhaar card
      const extractedData = await AadhaarValidationService.validateAadhaarCard(selectedFile);
      setExtractedData(extractedData);
      
      // Validate gender
      const genderValidation = AadhaarValidationService.validateGender(extractedData);
      
      if (!genderValidation.isValid) {
        setValidationResult({
          success: false,
          message: genderValidation.reason,
          data: extractedData
        });
        setValidationStep('result');
        onValidationFailure(genderValidation.reason);
        return;
      }

      // Success - store validation
      AadhaarValidationService.storeValidation(extractedData);
      
      setValidationResult({
        success: true,
        message: 'Aadhaar validation successful! Welcome to SafeRide.',
        data: extractedData
      });
      setValidationStep('result');
      
      // Call success callback
      setTimeout(() => {
        onValidationSuccess(extractedData);
      }, 2000);

    } catch (error) {
      console.error('Aadhaar validation error:', error);
      setError(error instanceof Error ? error.message : 'Failed to validate Aadhaar card');
      setValidationStep('upload');
      onValidationFailure('Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  // Reset validation
  const resetValidation = () => {
    setValidationStep('upload');
    setSelectedFile(null);
    setValidationResult(null);
    setExtractedData(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Render processing screen
  if (validationStep === 'processing') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="relative">
                <Loader2 className="h-16 w-16 animate-spin text-blue-600" />
                <Scan className="h-8 w-8 absolute top-4 left-4 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">Processing Aadhaar Card</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>🔍 Reading QR code...</p>
              <p>📄 Performing OCR extraction...</p>
              <p>🤖 Analyzing gender information...</p>
              <p>✅ Validating eligibility...</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-700">
                This may take 10-30 seconds depending on image quality
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render result screen
  if (validationStep === 'result') {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              {validationResult.success ? (
                <CheckCircle className="h-16 w-16 text-green-600" />
              ) : (
                <XCircle className="h-16 w-16 text-red-600" />
              )}
            </div>
            
            <h3 className={`text-lg font-semibold ${
              validationResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {validationResult.success ? 'Validation Successful!' : 'Validation Failed'}
            </h3>
            
            <p className="text-sm text-muted-foreground">
              {validationResult.message}
            </p>

            {extractedData && (
              <div className="bg-gray-50 p-3 rounded-lg text-left">
                <h4 className="font-medium mb-2">Extracted Information:</h4>
                <div className="space-y-1 text-sm">
                  {extractedData.name && (
                    <p><strong>Name:</strong> {extractedData.name}</p>
                  )}
                  <p><strong>Gender:</strong> {extractedData.gender || 'Not detected'}</p>
                  <p><strong>Method:</strong> {extractedData.method}</p>
                  <p><strong>Confidence:</strong> {extractedData.confidence}%</p>
                </div>
              </div>
            )}

            {!validationResult.success && (
              <Button onClick={resetValidation} className="w-full">
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render upload screen
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-600" />
          Aadhaar Verification
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload your Aadhaar card to verify gender for SafeRide access
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div className="space-y-2">
              <FileImage className="h-12 w-12 mx-auto text-gray-400" />
              <p className="text-sm font-medium">Upload Aadhaar Card</p>
              <p className="text-xs text-muted-foreground">
                Front side of Aadhaar card (JPG, PNG, PDF)
              </p>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="mt-2"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </Button>
            </div>
          </div>

          {/* Camera Capture */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Or</p>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              onClick={() => cameraInputRef.current?.click()}
              variant="outline"
              className="w-full"
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo
            </Button>
          </div>

          {/* Selected file preview */}
          {selectedFile && (
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  File selected: {selectedFile.name}
                </span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          )}

          {/* Process Button */}
          <Button
            onClick={processAadhaarCard}
            disabled={!selectedFile || isValidating}
            className="w-full"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Scan className="h-4 w-4 mr-2" />
            )}
            Verify Aadhaar Card
          </Button>
        </div>

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <strong>Privacy Protected:</strong> Your Aadhaar data is processed locally and not stored on our servers. Only gender verification is performed.
          </AlertDescription>
        </Alert>

        {/* Instructions */}
        <div className="bg-blue-50 p-3 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2">For best results:</h4>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Ensure good lighting</li>
            <li>• Keep the entire Aadhaar card in frame</li>
            <li>• Avoid shadows and glare</li>
            <li>• Use a flat surface</li>
            <li>• QR code should be visible if present</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default AadhaarValidation;