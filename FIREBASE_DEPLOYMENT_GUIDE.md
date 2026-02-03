# Firebase Deployment Guide for Educational AI Platform

This guide will walk you through deploying your Educational AI Platform to Firebase Hosting.

## Prerequisites

1. **Firebase CLI installed**: You already have Firebase CLI v15.2.0 installed
2. **Firebase project created**: You already have a project named `aitutor-4431c`
3. **Node.js and npm installed**: Required for building the application

## Understanding Your Current Configuration

Your project is already configured for Firebase deployment with:

- `firebase.json` - Configures hosting to serve from the `dist` folder
- `.firebaserc` - Links to your Firebase project `aitutor-4431c`
- `vite.config.js` - Builds to the `dist` folder as required by Firebase

## Important Note About Backend Services

Your application uses both frontend (React) and backend (Node.js) components:

- **Frontend**: Will be deployed to Firebase Hosting
- **Backend**: Currently configured to connect to `https://aitutor-backend-u7h3.onrender.com` (in `.env.production`)

For a complete deployment, you'll need to ensure your backend API is available at the production URL. The current setup assumes your backend is hosted separately on Render.

## Deployment Steps

### Step 1: Install Dependencies

First, make sure all dependencies are installed:

```bash
npm install
```

### Step 2: Build the Application

Create a production build of your React application:

```bash
npm run build
```

This command will:
- Build your React application
- Output files to the `dist` folder
- Optimize the build for production

### Step 3: Preview Locally (Optional)

You can preview your build locally before deploying:

```bash
firebase serve
```

### Step 4: Deploy to Firebase Hosting

Deploy your application to Firebase:

```bash
firebase deploy
```

Or deploy only the hosting component:

```bash
firebase deploy --only hosting
```

### Step 5: View Your Deployed Application

After deployment completes, you'll see a URL in the terminal. Your site will be available at:
- https://aitutor-4431c.web.app
- https://aitutor-4431c.firebaseapp.com

## Environment Variables for Production

Your application currently uses these important environment variables:

- `VITE_BACKEND_URL`: Points to your backend API (set to `https://aitutor-backend-u7h3.onrender.com`)
- AI/Supabase keys: These are handled on the client-side build

## Troubleshooting

### Common Issues:

1. **Build fails**: Make sure all dependencies are installed with `npm install`

2. **API calls fail after deployment**: Ensure your backend API at `https://aitutor-backend-u7h3.onrender.com` is accessible

3. **CORS errors**: Your backend (in `src/server/index.js`) is already configured with Firebase origins:
   - `https://aitutor-4431c.web.app`
   - `https://aitutor-backend-u7h3.firebaseapp.com`

4. **Missing environment variables**: Make sure `VITE_BACKEND_URL` is correctly set for production

### Useful Commands:

- Check your current Firebase project: `firebase use`
- List all your Firebase projects: `firebase projects:list`
- View deployment history: `firebase hosting:sites:versions:list aitutor-4431c`

## Post-Deployment Verification

After deployment:

1. Visit your site at https://aitutor-4431c.web.app
2. Check browser console for any errors
3. Test key functionality (login, course access, etc.)
4. Verify API calls are working properly

## Updating Your Deployment

To update your deployed application after making changes:

1. Make your code changes
2. Rebuild: `npm run build`
3. Deploy: `firebase deploy`

## Security Considerations

- Your API keys are included in the client-side build, which is typical for Vite applications using VITE_ prefixed variables
- Consider using environment-specific configurations for sensitive keys
- Monitor your API usage since client-side keys are exposed

## Need Help?

- Check Firebase documentation: https://firebase.google.com/docs/hosting
- Review your application logs in the Firebase Console
- Ensure your backend service is running and accessible