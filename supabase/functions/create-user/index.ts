// Fix: Declare Deno to prevent TypeScript errors when Deno's global types are not available.
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// This function is our entry point.
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Extract new employee data from the request body.
    const { fullName, badgeNumber, password } = await req.json();
    if (!fullName || !badgeNumber || !password) {
      return new Response(JSON.stringify({ error: 'Dados incompletos fornecidos.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // 2. Create a Supabase client to verify the caller's role (the admin).
    // It uses the Authorization token sent by the frontend to authenticate.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 3. Get the data of the user making the call (the admin).
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error("Usuário não autenticado.");
    }

    // 4. SECURITY CHECK: Confirm that the user is an admin.
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem criar usuários.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401, // 401 Unauthorized
      });
    }
    
    // 5. If the check passes, create the ADMIN client with superpowers (service_role).
    // It's safe to use the service_role_key here because this code runs on Supabase's server.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // 6. Create the new user in Supabase Auth.
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: `${badgeNumber}@lunchapp.local`,
      password: password,
      user_metadata: {
        full_name: fullName,
        badge_number: badgeNumber
      },
      email_confirm: true, // Mark the email as confirmed right away.
    });

    if (createError) {
      // If the error is because the user already exists, return a friendly message.
      if (createError.message.includes('unique constraint') || createError.message.includes('should be unique')) {
        return new Response(JSON.stringify({ error: 'Um usuário com este crachá já existe.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409, // 409 Conflict
        });
      }
      throw createError; // Throw other errors.
    }

    // 7. Return a success response.
    return new Response(JSON.stringify({ user: newUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201, // 201 Created
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});