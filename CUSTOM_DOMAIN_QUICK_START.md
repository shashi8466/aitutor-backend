# 🚀 Custom Domain Quick Start - aiprep365.com

## **Quick Setup (5-10 minutes active work)**

### **1️⃣ Firebase Console** (2 minutes)
```
→ https://console.firebase.google.com/
→ Select project: aitutor-4431c
→ Hosting → Add custom domain
→ Enter: aiprep365.com
→ Click Continue
```

### **2️⃣ Add DNS Records** (3-5 minutes)

**At your domain registrar (GoDaddy/Namecheap/Cloudflare):**

**Add A Record:**
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

**Add CNAME Record (for www):**
```
Type: CNAME
Name: www
Value: aitutor-4431c.web.app
TTL: 3600
```

### **3️⃣ Verify & SSL** (Wait 15-30 minutes)
```
→ Return to Firebase Console
→ Click "Verify"
→ Wait for SSL provisioning (5-10 min)
→ Enable "Redirect to HTTPS"
```

### **4️⃣ Test** (2 minutes)
```
✅ Visit: https://aiprep365.com/
✅ Should match: https://aitutor-4431c.web.app/
✅ Test login/signup
✅ Test all dashboards
```

---

## ⏱️ **Timeline**

| Step | Active Work | Waiting Time |
|------|-------------|--------------|
| 1. Firebase Setup | 2 min | - |
| 2. DNS Records | 3-5 min | - |
| 3. DNS Propagation | - | 15-30 min |
| 4. Firebase Verify | 1 min | - |
| 5. SSL Certificate | - | 5-10 min |
| 6. Testing | 2 min | - |
| **TOTAL** | **8-10 min** | **~45 min** |

---

## ✅ **Success Checklist**

- [ ] DNS records added at registrar
- [ ] Domain verified in Firebase
- [ ] SSL certificate provisioned
- [ ] HTTPS redirect enabled
- [ ] https://aiprep365.com/ loads correctly
- [ ] Login works on custom domain
- [ ] All dashboards accessible
- [ ] No browser console errors

---

## 🆘 **If Something Goes Wrong**

### **Domain not verifying?**
→ Wait longer (DNS can take 24-48 hours, usually 15-30 min)
→ Check: https://whatsmydns.net
→ Verify no typos in DNS records

### **SSL stuck on "Provisioning"?**
→ Wait up to 1 hour
→ Ensure DNS records are correct
→ Try removing and re-adding domain

### **Auth emails show Firebase domain?**
→ Update Supabase redirect URLs (see CUSTOM_DOMAIN_SETUP.md)

---

## 📞 **Need Help?**

**Full Guide:** See `CUSTOM_DOMAIN_SETUP.md` for detailed instructions

**Firebase Docs:** https://firebase.google.com/docs/hosting/custom-domain

**DNS Check:** https://whatsmydns.net

---

## 🎯 **End Result**

```
https://aiprep365.com/ = https://aitutor-4431c.web.app/
```

Same content, professional custom domain! 🎉
