# Edulari Vercel Deployment Guide

## Current Deployment URL
**https://edulari-test.vercel.app**

## Critical Environment Variables Required

Add these in Vercel Dashboard → Project Settings → Environment Variables:

### 1. Site Configuration
```env
NEXT_PUBLIC_SITE_URL=https://edulari-test.vercel.app
SITE_NAME=Edulari
ADMIN_EMAIL=support@edulari-test.vercel.app
CURRENCY_CODE=INR
CURRENCY_SYMBOL=₹
APP_TIMEZONE=Asia/Kolkata
```

### 2. Database (Supabase Postgres)
```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=20
DIRECT_URL=postgresql://postgres.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:5432/postgres
```

**Important**: 
- Both URLs must be identical (Session Pooler, transaction mode)
- Set `prepare: false` in postgres.js connection
- Get credentials from Supabase Dashboard → Settings → Database → Connection Strings → Session Pooler

### 3. Security & Sessions
```env
SESSION_SECRET=<generate with: openssl rand -base64 32>
CSRF_SECRET=<generate with: openssl rand -base64 32>
SESSION_COOKIE_NAME=edulari_session
SESSION_LIFETIME=86400
DATA_ENCRYPTION_KEY=<generate 32-char random string>
```

### 4. Email (Nodemailer SMTP)
For Gmail:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_AUTH=true
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMPT_FROM_EMAIL=noreply@edulari-test.vercel.app
SMTP_FROM_NAME=Edulari
EMAIL_DRY_RUN=false
```

**Gmail Setup**:
1. Enable 2FA on your Google account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use app password (not regular password)

### 5. Backblaze B2 Storage
```env
B2_BUCKET_NAME=edulari
B2_BUCKET_REGION=ap-south-1
B2_ENDPOINT=https://s3.ap-south-002.backblazeb2.com
B2_BUCKET_ID=<your-bucket-id>
B2_KEY_ID=<your-application-key-id>
B2_APPLICATION_KEY=<your-application-key>
```

Get credentials from:
1. Backblaze Account → Applications and Keys
2. Create application key with "Can read and write all files" permission
3. Create bucket in ap-south region (Mumbai)

### 6. Razorpay Payments
```env
RAZORPAY_KEY_ID=rzp_test_<your-key-id>
RAZORPAY_KEY_SECRET=<your-secret-key>
RAZORPAY_WEBHOOK_SECRET=<webhook-signing-secret>
RAZORPAY_LIVE=false
```

Get from: Razorpay Dashboard → Settings → API Keys

**Webhook Setup**:
1. Add webhook endpoint: https://edulari-test.vercel.app/api/payment/razorpay/webhook
2. Select events: `order.created`, `paymentcaptured`, `payment.refunded`
3. Copy webhook signing secret

### 7. OAuth Providers (Optional)
Google OAuth:
```env
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
```

GitHub OAuth:
```env
GITHUB_CLIENT_ID=<your-client-id>
GITHUB_CLIENT_SECRET=<your-client-secret>
```

### 8. AI Features (Optional)
```env
ACTIVE_AI_PROVIDER=openrouter
OPENROUTER_API_KEY=<your-api-key>
OPENROUTER_MODEL=microsoft/phi-3-mini-128k-instruct
GROQ_API_KEY=<your-api-key>
GROQ_MODEL=llama-3.3-70b-versatile
AI_REQUEST_TIMEOUT=45
AI_CONNECT_TIMEOUT=10
AI_MAX_EXEC_TIME=60
```

### 9. Cron Jobs Secret
```env
CRON_SECRET=<generate random string, e.g., npx crypto-random-string -l 32>
```

Used to protect `/api/cron/*` routes from unauthorized access.

---

## Deployment Steps

### Step 1: Push to GitHub ✅
Code has been pushed to: https://github.com/piyushkumarq13/edulari-test

### Step 2: Connect to Vercel
1. Go to vercel.com → Import Repository
2. Select `piyushkumarq13/edulari-test`
3. Click "Import"

### Step 3: Configure Build
- **Framework Preset**: Next.js
- **Root Directory**: `/` (empty)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### Step 4: Add Environment Variables
Copy all variables above into Vercel dashboard.

**Important**: Add them at production level first, then dev/staging if needed.

### Step 5: Deploy
Click "Deploy" - Wait for build to complete (~3-5 minutes)

### Step 6: Run Database Migrations
After deployment, you need to manually initialize the database:

#### Option A: Using Vercel CLI (Recommended)
```bash
npm i -g vercel
cd "C:\Users\piyus\Desktop\htdocs (7)\Edulari"
vercel login
vercel env pull DATABASE_URL DIRECT_URL SESSION_SECRET CSRF_SECRET DATA_ENCRYPTION_KEY
npx tsx scripts/migrate.ts
npx tsx scripts/create-admin.ts
```

#### Option B: Using Vercel Dashboard
1. Run: `npx tsx scripts/create-admin.ts` via Vercel Functions or local deploy
2. Follow interactive prompts to create admin user

### Step 7: Verify Health Check
Visit: https://edulari-test.vercel.app/api/health

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-10-11T...",
  "database": "connected",
  "environment": "production"
}
```

---

## Common Errors & Fixes

### Error: "Invalid URL" in redirects
**Cause**: Missing `NEXT_PUBLIC_SITE_URL` environment variable  
**Fix**: Add it to Vercel environment variables

### Error: "Database connection failed"
**Cause**: Wrong PostgreSQL credentials or pooler settings  
**Fix**: Verify both DATABASE_URL and DIRECT_URL use correct values from Supabase dashboard

### Error: "Email not sending"
**Cause**: Gmail app password not enabled or wrong port  
**Fix**: 
1. Use app password, not regular password
2. SMTP_PORT should be 587 (TLS)
3. Set EMAIL_DRY_RUN=false

### Error: "Login/Register doesn't work"
**Cause**: Cookie path not set correctly or HTTPS issues  
**Fix**: This is already fixed in code - cookies use `Path=/` and check `NODE_ENV === "production"` for secure flag

### Error: 404 on pages
**Cause**: Routes not built or ISR caching issue  
**Fix**: 
1. Go to Vercel dashboard → Redeploy
2. Or clear Next.js cache by deleting `.next` folder

### Error: "CORS policy violation"
**Cause**: Frontend/backend mismatch  
**Fix**: Ensure NEXT_PUBLIC_SITE_URL matches deployed domain exactly (no trailing slash)

---

## Post-Deployment Checklist

✅ Visit homepage and verify navbar loads  
✅ Try login flow (check for console errors)  
✅ Test registration (verify email sent)  
✅ Visit static pages: About, Browse Courses, Categories  
✅ Check mobile responsiveness  
✅ Verify favicon loads  
✅ Test contact form submission  
✅ Check footer links  

---

## Monitoring

### Vercel Analytics
Enable analytics: Vercel Dashboard → Analytics

### Logs
View runtime logs: Vercel Dashboard → Logs

### Database Queries
Monitor performance: Supabase Dashboard → Activity

---

## Troubleshooting Commands

```bash
# Test build locally
npm run build

# Type check
npm run typecheck

# Lint check
npm run lint

# Start production server
npm run start

# Create admin user interactively
npx tsx scripts/create-admin.ts

# Run migrations manually
npx tsx scripts/migrate.ts
```

---

## Support

If you encounter issues:
1. Check browser console (F12)
2. Check Vercel deployment logs
3. Review terminal output when running commands
4. Verify all environment variables are set
5. Test `/api/health` endpoint

---

## Production Considerations

### Free Tier Limits (Vercel Hobby)
- 100 GB bandwidth/month
- 1000 function execution hours/month
- Daily cron jobs only (already configured)
- No dedicated database

### Recommended Upgrades (if needed)
- Pro plan ($20/mo) - More function execution time
- Better bandwidth limits
- Advanced analytics
- Priority support

### Backup Strategy
- Regular Supabase database backups (enable in dashboard)
- Export critical data periodically
- Store Backblaze B2 buckets with versioning enabled

---

**Document Version**: 1.0  
**Last Updated**: 2026-10-11  
**Next Review**: After first production deployment
