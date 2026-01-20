
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://wqavuacgbawhgcdxxzom.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// Initialize Admin Client
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

router.get('/', (req, res) => {
    res.send(`
    <html>
      <head>
        <title>Manual User Confirmation</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f2f5; }
          .card { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
          input { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          button { width: 100%; padding: 10px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; }
          button:hover { background: #059669; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="margin-top:0">Manual Email Fix</h2>
          <p>Since email delivery might be failing in dev, use this to manually verify your account.</p>
          <form action="/api/auth-debug/confirm" method="POST">
            <input type="email" name="email" placeholder="Enter your email (ssky57771@gmail.com)" required value="ssky57771@gmail.com">
            <button type="submit">Verify Now</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

router.post('/confirm', express.urlencoded({ extended: true }), async (req, res) => {
    const { email } = req.body;

    if (!SERVICE_KEY) {
        return res.status(500).send("Server Error: Service Role Key is missing.");
    }

    try {
        console.log(`🔍 Searching for user: ${email}`);

        // 1. List users (Note: listUsers doesn't support filtering by email directly in all versions, so we fetch and find)
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();

        if (listError) throw listError;

        const user = users.find(u => u.email === email);

        if (!user) {
            return res.send(`
            <div style="font-family: sans-serif; padding: 20px;">
                <h1 style="color: red">User Not Found</h1>
                <p>Could not find a user with email: <strong>${email}</strong></p>
                <p>Ensure you have signed up first.</p>
                <a href="/api/auth-debug">Try Again</a>
            </div>
        `);
        }

        console.log(`✅ Found user: ${user.id}`);

        // 2. Confirm user
        const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            user.id,
            { email_confirm: true } // This sets confirmed_at inside Supabase Auth
        );

        if (updateError) throw updateError;

        console.log(`✅ User verified: ${email}`);

        res.send(`
        <div style="font-family: sans-serif; padding: 20px; text-align: center; margin-top: 50px;">
            <h1 style="color: #10b981">🎉 Verification Success!</h1>
            <p>The email <strong>${email}</strong> has been manually verified.</p>
            <br>
            <a href="http://localhost:5173/auth" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Login</a>
        </div>
    `);

    } catch (e) {
        console.error("Verification failed:", e);
        res.send(`
        <div style="font-family: sans-serif; padding: 20px;">
            <h1 style="color: red">Error</h1>
            <pre>${e.message}</pre>
            <a href="/api/auth-debug">Try Again</a>
        </div>
    `);
    }
});

export default router;
