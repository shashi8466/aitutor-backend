-- Allow admins to delete demo leads
CREATE POLICY "Admins can delete demo leads" ON public.demo_leads
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);
