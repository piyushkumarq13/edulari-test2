# Edulari Quick Reference - Deployment Checklist

## Your Deployed URL
**https://edulari-test.vercel.app**

## Environment Variables to Set in Vercel

### ✅ Critical (Must Have)
```
NEXT_PUBLIC_SITE_URL=https://edulari-test.vercel.app
DATABASE_URL=<from Supabase Session Pooler>
DIRECT_URL=<same as DATABASE_URL>
SESSION_SECRET=<random 32-char>
CSRF_SECRET=<random 32-char>
DATA_ENCRYPTION_KEY=<random 32-char>
CRON_SECRET=<random string>
```

### 🔧 Email Setup (Choose one)

**Gmail**:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_AUTH=true
SMTP_USERNAME=your@gmail.com
SMTP_PASSWORD=<app-password>
SMTP_FROM_EMAIL=noreply@edulari-test.vercel.app
SMTP_FROM_NAME=Edulari
```

### 💰 Payment Gateway
```
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
RAZORPAY_WEBHOOK_SECRET=xxx
RAZORPAY_LIVE=false
```

### 📦 File Storage (Optional - skip for now)
```
B2_BUCKET_NAME=edulari
B2_ENDPOINT=https://s3.ap-south-002.backblazeb2.com
B2_REGION=ap-south-1
B2_KEY_ID=xxx
B2_APPLICATION_KEY=xxx
```

---

## Deployment Steps (Quick)

1. **Vercel Dashboard** → Import Repository
2. Select: `piyushkumarq13/edulari-test`
3. Build Command: `npm run build`
4. Add all environment variables above
5. Click Deploy
6. Wait ~3-5 minutes

---

## After Deployment

### Initialize Database
Run via Vercel CLI locally:
```bash
cd "C:\Users\piyus\Desktop\htdocs (7)\Edulari"
npx tsx scripts/migrate.ts
npx tsx scripts/create-admin.ts
```

Follow interactive prompts to create admin user.

### Test Everything
✅ Visit: https://edulari-test.vercel.app  
✅ Check: https://edulari-test.vercel.app/api/health  

### Expected Health Response
```json
{"status":"ok","database":"connected",...}
```

---

## If Something Breaks

### 1. Check Browser Console (F12)
Look for red errors, especially:
- CORS errors
- Network request failures
- JavaScript runtime errors

### 2. Check Vercel Logs
Dashboard → Logs → Filter by function name

### 3. Verify Environment Variables
- All vars set? ✓
- No typos? ✓
- No trailing spaces? ✓
- URLs match exactly? ✓

### 4. Redeploy
Dashboard → Deployments → Click latest → "Redeploy"

### 5. Clear Cache
Delete `.next` folder → Redeploy

---

## Common Fixes Applied

| Issue | Status |
|-------|--------|
| Update localhost URLs | ✅ Fixed |
| Update example.com URLs | ✅ Fixed |
| Production fallback URLs | ✅ Added |
| Cookie security settings | ✅ Configured |
| Cron jobs (Hobby compliant) | ✅ Daily only |
| Region optimization | ✅ Mumbai (bom1) |

---

## Next Steps

### Immediate Actions:
1. [ ] Set up all environment variables in Vercel
2. [ ] Deploy to Vercel
3. [ ] Run database migrations
4. [ ] Create first admin user
5. [ ] Test basic functionality

### Optional Features:
- [ ] Enable AI course chat (needs API keys)
- [ ] Configure Razorpay payments
- [ ] Set up Google/GitHub OAuth
- [ ] Configure Backblaze B2 storage
- [ ] Custom domain setup

---

## Commands Reference

```bash
# Development
npm run dev         # Start dev server
npm run build       # Build for production
npm start           # Start production server

# Database
npx tsx scripts/migrate.ts        # Run migrations
npx tsx scripts/create-admin.ts   # Create admin user
npx tsx scripts/seed-e2e-users.ts # Create test users

# Testing
npm run typecheck   # TypeScript check
npm run lint        # ESLint check
npm run test:e2e    # Playwright tests

# Git
git push            # Push changes
git pull            # Pull updates
```

---

## Support Resources

**GitHub Repo**: https://github.com/piyushkumarq13/edulari-test  
**Full Guide**: `/docs/DEPLOYMENT_GUIDE.md`  
**Project Docs**: `/docs/FINAL_SUMMARY.md`  
**Migration Rules**: `/AGENTS.md`

---

**Remember**: The code is already deployed to GitHub. Just connect it to Vercel and add your credentials!
