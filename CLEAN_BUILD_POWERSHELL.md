# 🚀 Clean Build Commands for Windows PowerShell

## **Correct PowerShell Syntax**

### **Option 1: PowerShell Native Commands**

```powershell
# 1. Delete dist folder
Remove-Item -Recurse -Force dist

# 2. Delete Vite cache
Remove-Item -Recurse -Force node_modules\.vite

# 3. Clear npm cache
npm cache clean --force

# 4. Reinstall dependencies
npm install

# 5. Build project
npm run build

# 6. Deploy to Firebase
firebase deploy --only hosting
```

---

### **Option 2: Using CMD-style in PowerShell**

```powershell
# This also works in PowerShell
rd -r -fo dist
rd -r -fo node_modules\.vite
npm cache clean --force
npm install
npm run build
firebase deploy --only hosting
```

---

### **Option 3: One-Liner PowerShell Command**

```powershell
Remove-Item -Recurse -Force dist, node_modules\.vite -ErrorAction SilentlyContinue; npm cache clean --force; npm install; npm run build; firebase deploy --only hosting
```

---

## 📋 **Complete Fix Process**

### **Step 1: Stop Any Running Processes**
Press `Ctrl+C` in any running terminals

### **Step 2: Clean Everything**
```powershell
Remove-Item -Recurse -Force dist
Remove-Item -Recurse -Force node_modules\.vite
npm cache clean --force
```

### **Step 3: Reinstall & Build**
```powershell
npm install
npm run build
```

### **Step 4: Deploy**
```powershell
firebase deploy --only hosting
```

### **Step 5: Test**
Visit: https://aiprep365.com/
Press `Ctrl+Shift+R` to hard refresh

---

## ✅ **Quick Reference**

| Action | Command |
|--------|---------|
| Delete folder | `Remove-Item -Recurse -Force foldername` |
| Delete multiple | `Remove-Item -Recurse -Force folder1, folder2` |
| Clean npm cache | `npm cache clean --force` |
| Install deps | `npm install` |
| Build | `npm run build` |
| Deploy | `firebase deploy --only hosting` |

---

## 🔧 **Alternative: Use Batch File**

Create a file named `clean-build.bat`:

```batch
@echo off
echo Cleaning build...
rmdir /s /q dist
rmdir /s /q node_modules\.vite
echo Clearing npm cache...
npm cache clean --force
echo Installing dependencies...
npm install
echo Building project...
npm run build
echo Deploying to Firebase...
firebase deploy --only hosting
echo Done!
pause
```

Then just run:
```
.\clean-build.bat
```

---

## 🎯 **What You Should See**

After running the commands, you should see:

```
✅ Dependencies installed
✅ Build completed successfully
✅ Firebase deployment complete
Hosting URL: https://aitutor-4431c.web.app
```

Then test at:
- https://aiprep365.com/
- https://aitutor-4431c.web.app/

Both should show identical content! 🎉
