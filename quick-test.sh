#!/bin/bash
# Quick API Test Script

echo "🧪 Testing Demo API Endpoints..."
echo ""

BACKEND_URL="https://aitutor-backend-u7h3.onrender.com"

# Test 1: Health Check
echo "1️⃣ Health Check..."
curl -s "$BACKEND_URL/api/health" | python -m json.tool
echo ""

# Test 2: Check if demo route exists
echo "2️⃣ Testing Demo Lead Submission..."
curl -s -X POST "$BACKEND_URL/api/demo/submit-lead" \
  -H "Content-Type: application/json" \
  -d '{
    "courseId": 1,
    "fullName": "Test User",
    "grade": "10",
    "email": "test@example.com",
    "phone": "+1234567890",
    "level": "Easy",
    "scoreDetails": {
      "correctCount": 5,
      "totalQuestions": 10,
      "currentLevelPercentage": 50,
      "scaledScore": 1200
    }
  }' | python -m json.tool
echo ""

echo "✅ Tests complete!"
