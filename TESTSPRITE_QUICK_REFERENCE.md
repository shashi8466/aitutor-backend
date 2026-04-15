# TestSprite Quick Reference

## 🚀 Quick Start

```bash
# Start all services
npm run server        # Terminal 1 - Backend (port 3001)
npm run client        # Terminal 2 - Frontend (port 5173)

# Run tests
node run-testsprite-tests.cjs   # Terminal 3 - Tests
```

## 📊 Current Status

```
✅ Total Tests: 13
✅ Passed: 13 (100%)
❌ Failed: 0
⏱️  Duration: ~2 seconds
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `testsprite-config.json` | Test configuration |
| `run-testsprite-tests.cjs` | Test runner |
| `testsprite_tests/test-report.html` | Visual report |
| `testsprite_tests/test-report.json` | Detailed results |
| `TESTSPRITE_TESTING_GUIDE.md` | Full documentation |

## ✅ Test Suites

1. **Health Check** (1 test)
2. **Knowledge Base Quiz** (3 tests)
3. **AI Tutor** (2 tests)
4. **Upload System** (1 test)
5. **Contact System** (1 test)
6. **UI Components** (3 tests - simulated)
7. **Performance** (2 tests)

## 🔍 View Reports

```bash
# Windows
start testsprite_tests/test-report.html

# Mac/Linux
open testsprite_tests/test-report.html
```

## 🛠️ Common Commands

```bash
# Run tests
node run-testsprite-tests.cjs

# Check backend
curl http://localhost:3001/api/health

# Check frontend
curl http://localhost:5173
```

## ⚠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| Backend not running | `npm run server` |
| Frontend not running | `npm run client` |
| Tests failing | Check server logs |
| 404 errors | Verify endpoint in config |

## 📝 Add New Test

Edit `testsprite-config.json`:

```json
{
  "name": "Test Name",
  "type": "api",
  "endpoint": "/api/endpoint",
  "method": "GET",
  "expectedStatus": 200,
  "validations": [
    "response.data.status === 'ok'"
  ]
}
```

## 🎯 Validation Examples

```javascript
// Truthy check
"response.data.message"

// Equality
"response.data.status === 'ok'"

// Array check
"Array.isArray(response.data.items)"

// Array operations
"response.data.questions.every(q => q.text)"

// Length check
"response.data.items.length > 0"

// OR condition
"response.data.a || response.data.b"
```

## 📚 Full Documentation

See `TESTSPRITE_TESTING_GUIDE.md` for complete documentation.

---

**Last Updated:** April 10, 2026  
**Status:** ✅ All Tests Passing
