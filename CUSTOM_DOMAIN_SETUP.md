# 🌐 Custom Domain Setup Guide - aiprep365.com

## **Overview**

This guide will help you configure your custom domain `https://aiprep365.com/` to display the same content as your Firebase-hosted app at `https://aitutor-4431c.web.app/`.

---

## ✅ **Prerequisites**

- Firebase project: `aitutor-4431c` (already configured)
- Custom domain: `aiprep365.com` (you own this domain)
- Access to your domain registrar's DNS settings

---

## 📋 **Step-by-Step Instructions**

### **Step 1: Add Custom Domain in Firebase Console**

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Select project: **aitutor-4431c**

2. **Navigate to Hosting**
   - Click **"Hosting"** in the left sidebar
   - You'll see your current site: `aitutor-4431c.web.app`

3. **Add Custom Domain**
   - Click **"Add custom domain"** button
   - Enter domain: `aiprep365.com`
   - Click **"Continue"**

4. **Choose Domain Type**
   - **Option 1:** Root domain (`aiprep365.com`)
   - **Option 2:** Subdomain (`www.aiprep365.com`)
   - **Recommended:** Add both for complete coverage

---

### **Step 2: Configure DNS Records**

Firebase will provide DNS records to verify ownership. You need to add these to your domain registrar.

#### **Where to Update DNS:**

Log in to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.) and find:
- **"DNS Management"**
- **"DNS Settings"**
- **"Name Server Settings"**

#### **Required DNS Records:**

**For Root Domain (`aiprep365.com`):**
Add two A records pointing to Firebase Hosting:

```
Type: A
Name: @ (or leave blank)
Value: 199.36.158.100
TTL: 3600 (or default)
```

```
Type: A
Name: @ (or leave blank)
Value: 151.101.1.195
TTL: 3600 (or default)
```

**For WWW Subdomain (`www.aiprep365.com`):**
Add a CNAME pointing to your Firebase app:

```
Type: CNAME
Name: www
Value: aitutor-4431c.web.app
TTL: 3600 (or default)
```

**IMPORTANT:** Do NOT use Vercel IPs (like 76.76.21.21) if you are deploying to Firebase as this will cause "reverting to old version" issues!


---

### **Step 3: Verify Domain Ownership**

1. **Wait for DNS Propagation**
   - DNS changes can take 5 minutes to 48 hours
   - Usually completes within 15-30 minutes
   - Use tools like [whatsmydns.net](https://whatsmydns.net) to check propagation

2. **Verify in Firebase**
   - Return to Firebase Console > Hosting
   - Click **"Verify"** next to your custom domain
   - Firebase will check DNS records

3. **Troubleshooting Verification**
   - If verification fails, wait 10 more minutes
   - Double-check DNS record values
   - Ensure no typos in domain names
   - Try clearing DNS cache: `nslookup -flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

---

### **Step 4: Configure SSL Certificate**

Firebase automatically provisions free SSL certificates via Let's Encrypt.

1. **Automatic SSL Provisioning**
   - After verification, Firebase automatically requests SSL certificate
   - Takes 5-10 minutes typically
   - Status shows "Provisioning certificate"

2. **SSL Completion**
   - Status changes to "Certificate provisioned"
   - Your site is now available at `https://aiprep365.com`

3. **Enable HTTPS Redirect (Recommended)**
   - Toggle **"Redirect HTTP to HTTPS"** to ON
   - Ensures all traffic uses secure connection
   - Improves SEO and security

---

### **Step 5: Test Your Custom Domain**

1. **Test Basic Access**
   ```
   https://aiprep365.com/
   https://www.aiprep365.com/
   ```

2. **Test Authentication**
   - Try logging in to student/parent/tutor/admin dashboards
   - Verify all features work correctly

3. **Test Supabase Authentication**
   - Ensure login/signup works on custom domain
   - Check email redirects use custom domain

4. **Compare with Firebase Domain**
   ```
   https://aitutor-4431c.web.app/  ← Original
   https://aiprep365.com/          ← New (should be identical)
   ```

---

## 🔧 **Advanced Configuration**

### **Optional: Update Supabase Auth Redirect URLs**

If you experience issues with email verification or password reset links:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `wqavuacgbawhgcdxxzom`
3. Navigate to **Authentication** → **URL Configuration**
4. Add these URLs to **Site URL**:
   ```
   https://aiprep365.com
   https://www.aiprep365.com
   ```
5. Add to **Redirect URLs**:
   ```
   https://aiprep365.com/**
   https://www.aiprep365.com/**
   ```

This ensures auth emails use your custom domain instead of Firebase domain.

---

## 🚀 **Deployment Workflow**

After setting up the custom domain, your deployment workflow remains the same:

### **Deploy Updates:**

```bash
# 1. Build your app
npm run build

# 2. Deploy to Firebase
firebase deploy --only hosting

# 3. Verify on both domains
# - https://aitutor-4431c.web.app/
# - https://aiprep365.com/
```

Both domains will show identical content automatically!

---

## 🔍 **Troubleshooting**

### **Issue 1: Domain Not Verifying**

**Symptoms:**
- Firebase shows "Verification failed"
- DNS records not propagating

**Solutions:**
1. Wait 30 minutes for DNS propagation
2. Check DNS propagation: https://whatsmydns.net
3. Verify no typos in DNS records
4. Contact domain registrar support if >24 hours

---

### **Issue 2: SSL Certificate Stuck on "Provisioning"**

**Symptoms:**
- Status shows "Provisioning certificate" for >30 minutes
- Site accessible via HTTP but not HTTPS

**Solutions:**
1. Wait up to 1 hour (can be slow)
2. Ensure DNS records are correct
3. Try removing and re-adding the domain
4. Check Firebase status page for outages

---

### **Issue 3: Authentication Redirects to Firebase Domain**

**Symptoms:**
- Email verification links go to `aitutor-4431c.web.app`
- Password reset emails show Firebase domain

**Solution:** Update Supabase redirect URLs (see "Optional: Update Supabase Auth Redirect URLs" above)

---

## 📊 **DNS Propagation Check**

Use these tools to verify DNS setup:

1. **General DNS Check:**
   - https://whatsmydns.net
   - Enter: `aiprep365.com`
   - Check A records point to Firebase IPs

2. **SSL Check:**
   - https://ssllabs.com/ssltest
   - Enter: `aiprep365.com`
   - Should show valid Let's Encrypt certificate

---

## ✅ **Success Criteria**

You'll know everything is working when:

1. ✅ **Domain Verified:** Firebase shows "Verified" status
2. ✅ **SSL Active:** HTTPS works with valid certificate
3. ✅ **Content Matches:** Both domains show identical content
4. ✅ **Auth Works:** Login/signup/password reset all work on custom domain
5. ✅ **Redirects Work:** HTTP → HTTPS redirect functions properly
6. ✅ **No Errors:** No console errors or mixed content warnings

---

## 🎯 **Quick Reference Commands**

### **Check DNS Propagation:**
```bash
# Windows
nslookup aiprep365.com

# Mac/Linux
dig aiprep365.com
```

### **Test Locally (Before DNS Propagates):**
Add to your hosts file temporarily:

**Windows:** `C:\Windows\System32\drivers\etc\hosts`
**Mac/Linux:** `/etc/hosts`

```
76.76.21.21    aiprep365.com
76.76.21.21    www.aiprep365.com
```

⚠️ **Remember to remove these entries after testing!**

---

## 📞 **Support Resources**

### **Firebase Documentation:**
- [Custom Domain Setup](https://firebase.google.com/docs/hosting/custom-domain)
- [SSL Certificate Info](https://firebase.google.com/docs/hosting/troubleshooting#https-issues)

### **DNS Tools:**
- [DNS Propagation Check](https://whatsmydns.net)
- [DNS Lookup](https://mxtoolbox.com/DNSLookup.aspx)

---

## 🎉 **Post-Setup Checklist**

After successful setup:

- [ ] Test all pages on `https://aiprep365.com`
- [ ] Verify login/signup works
- [ ] Test password reset emails
- [ ] Check email verification links
- [ ] Test student dashboard
- [ ] Test parent dashboard
- [ ] Test tutor dashboard
- [ ] Test admin dashboard
- [ ] Verify all API calls work
- [ ] Check Supabase authentication
- [ ] Test on mobile devices
- [ ] Share custom domain with users!

---

## 🌟 **Summary**

Once complete:
- ✅ Your app at `https://aiprep365.com/` = `https://aitutor-4431c.web.app/`
- ✅ Automatic free SSL certificate
- ✅ Same Firebase Hosting infrastructure
- ✅ Zero code changes required
- ✅ Both domains work simultaneously
- ✅ Professional custom domain for production!

**Estimated Setup Time:** 30 minutes to 2 hours (mostly waiting for DNS propagation)

**Good luck with your custom domain setup! 🚀**
