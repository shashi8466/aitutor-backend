# How to Create the notification_outbox Table

## Option 1: Run via Supabase Dashboard
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" 
3. Copy and paste the SQL command below
4. Click "Run" to execute

## Option 2: Run via API (if you have API access)
```bash
curl -X POST 'https://your-project.supabase.co/rest/v1/rpc' \
  -H 'apikey: YOUR_SUPABASE_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "role": "postgres",
    "sql": "CREATE TABLE public.notification_outbox ( id UUID DEFAULT gen_random_uuid() PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT now() NOT NULL, event_type TEXT NOT NULL, recipient_profile_id UUID REFERENCES public profiles(id), recipient_type TEXT NOT NULL, status TEXT NOT NULL, message TEXT, channels TEXT[], scheduled_for TIMESTAMPTZ, processed_at TIMESTAMPTZ, error_message TEXT, sender_profile_id UUID REFERENCES public profiles(id) );"
  }'
```

## Option 3: Using Supabase CLI
```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Run the migration
supabase db push --create-notification-outbox-table
```

## The SQL Command
```sql
CREATE TABLE public.notification_outbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  event_type TEXT NOT NULL,
  recipient_profile_id UUID REFERENCES public profiles(id),
  recipient_type TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  channels TEXT[],
  scheduled_for TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  sender_profile_id UUID REFERENCES public profiles(id)
);
```

## After Creating the Table
Once the table is created, the notification system will work perfectly! The notification history page will be able to:
- ✅ Display real notification data
- ✅ Filter by type (test completion, weekly progress, due date)
- ✅ Show delivery status for each channel
- ✅ Paginate through large notification lists
- ✅ Track when notifications were sent and processed

## Next Steps
1. Create the table using one of the methods above
2. Restart your backend server
3. Test the notification history page: `http://localhost:5173/student/notifications/history`

Your notification system will then be fully functional with real database storage! 🎉
