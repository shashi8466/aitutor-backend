# DNS Configuration Template for aiprep365.com

Copy these DNS records to your domain registrar's DNS settings.

---

## 📋 **DNS Records to Add**

### **Option A: Simple Setup (Recommended)**

**Record 1 - Root Domain:**
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
Proxy: Disabled (DNS only)
```

**Record 2 - WWW Subdomain:**
```
Type: CNAME
Name: www
Value: aitutor-4431c.web.app
TTL: 3600
Proxy: Disabled (DNS only)
```

---

### **Option B: Redundant Setup (Better Uptime)**

**Add all 4 Firebase IP addresses:**

**Record 1:**
```
Type: A
Name: @
Value: 76.76.21.21
TTL: 3600
```

**Record 2:**
```
Type: A
Name: @
Value: 76.76.21.22
TTL: 3600
```

**Record 3:**
```
Type: A
Name: @
Value: 76.76.21.23
TTL: 3600
```

**Record 4:**
```
Type: A
Name: @
Value: 76.76.21.24
TTL: 3600
```

**Record 5 (for www):**
```
Type: CNAME
Name: www
Value: aitutor-4431c.web.app
TTL: 3600
```

---

## 🌐 **Domain Registrar Specific Instructions**

### **GoDaddy:**
1. Go to "My Products"
2. Find your domain → Click "DNS"
3. Click "Add New Record"
4. Copy values from above
5. Click "Save"

### **Namecheap:**
1. Go to "Domain List"
2. Click "Manage" next to your domain
3. Go to "Advanced DNS" tab
4. Click "Add New Record"
5. Copy values from above
6. Click green checkmark to save

### **Cloudflare:**
1. Go to your domain in Cloudflare dashboard
2. Click "DNS" in sidebar
3. Click "Add Record"
4. Copy values from above
5. **Important:** Turn OFF proxy (gray cloud, not orange)
6. Click "Save"

### **Google Domains:**
1. Go to "My Domains"
2. Click on your domain
3. Click "DNS" tab
4. Click "Add Custom Host Record" or "Add Alias"
5. Copy values from above
6. Click "Add"

### **Bluehost:**
1. Go to "Domains" → "Domain Management"
2. Click "DNS" next to your domain
3. Click "Add DNS Record"
4. Copy values from above
5. Click "Save"

### **HostGator:**
1. Go to "Domains" → "Zone Editor"
2. Select your domain
3. Click "Add Record"
4. Copy values from above
5. Click "Save Record"

---

## ✅ **After Adding Records**

1. **Wait 5-30 minutes** for DNS propagation
2. **Verify at:** https://whatsmydns.net
   - Enter: `aiprep365.com`
   - Should show Firebase IPs (76.76.21.x)
3. **Return to Firebase Console** and click "Verify"
4. **Wait for SSL** (5-10 minutes)
5. **Test:** https://aiprep365.com/

---

## 🔍 **Verification Commands**

### **Windows:**
```cmd
nslookup aiprep365.com
```

### **Mac/Linux:**
```bash
dig aiprep365.com
```

### **Expected Output:**
```
Name:   aiprep365.com
Address: 76.76.21.21
Address: 76.76.21.22
Address: 76.76.21.23
Address: 76.76.21.24
```

---

## ⚠️ **Important Notes**

1. **Remove Old Records:** If you have existing A records for `@` or CNAME for `www`, remove them first
2. **Don't Change Nameservers:** Keep using your current nameservers (no need to change to Firebase nameservers)
3. **Cloudflare Users:** Make sure proxy is OFF (gray cloud, not orange) for these records
4. **TTL:** If your registrar doesn't allow 3600, use the default or lowest available value

---

## 🆘 **Troubleshooting**

### **Can't add A record with @ symbol?**
Try leaving the Name field blank instead

### **Multiple values for same record?**
Some registrars allow multiple IP addresses for one A record, separated by commas

### **Already have CNAME for www?**
Remove the old CNAME before adding the new one

### **Changes not showing?**
- Clear browser cache
- Wait longer (can take up to 48 hours, but usually 15-30 min)
- Check at https://whatsmydns.net to see global propagation

---

## 📞 **Need More Help?**

**Firebase Documentation:**
https://firebase.google.com/docs/hosting/custom-domain

**DNS Propagation Check:**
https://whatsmydns.net

**DNS Lookup Tool:**
https://mxtoolbox.com/DNSLookup.aspx

---

**Good luck! Your custom domain will be live soon! 🎉**
