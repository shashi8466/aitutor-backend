# 🚀 **INSTANT FIX - Copy & Paste This**

## **Step 1: Open TWO Terminals**

### **Terminal 1 (Backend):**
```bash
npm run server
```

**Wait for this message:**
```
🚀 Server running on http://0.0.0.0:3001
```

---

### **Terminal 2 (Frontend):**
```bash
npm run client
```

**Wait for this message:**
```
Local: http://localhost:5173
```

---

## **Step 2: Test Upload**

1. Go to http://localhost:5173
2. Login as admin
3. Try uploading Q11.docx again
4. ✅ **It should work now!**

---

## **If It Still Fails:**

Run this in a new terminal:
```bash
curl http://localhost:3001/api/health
```

**Expected:**
```json
{"status":"ok"}
```

**If you get "Connection refused":**
- The backend didn't start
- Check Terminal 1 for error messages
- Try: `npm install` then `npm run server` again

---

## **Pro Tip: Use One Command**

Instead of two terminals, just run:
```bash
npm run dev
```

This starts **both** servers automatically! ✨