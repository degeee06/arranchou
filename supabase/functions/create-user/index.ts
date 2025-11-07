// Fix: Declare Deno to prevent TypeScript errors when Deno's global types are not available.
declare const Deno: any;

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  // ✅ 1. Responde imediatamente a preflight (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ✅ 2. Extrai dados enviados pelo frontend
    const { fullName, badgeNumber, password } = await req.json();
    if (!fullName || !badgeNumber || !password) {
      return new Response(JSON.stringify({ error: 'Dados incompletos fornecidos.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // ✅ 3. Captura o Authorization header (se existir)
    const authHeader = req.headers.get('Authorization') || '';

    // ✅ 4. Cria o cliente do Supabase com o token do usuário
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // ✅ 5. Verifica o usuário autenticado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // ✅ 6. Checa se é admin
    const { data: adminProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || adminProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Acesso negado. Apenas administradores podem criar usuários.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // ✅ 7. Usa o service_role para criar o novo usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: `${badgeNumber}@lunchapp.local`,
      password,
      user_metadata: {
        full_name: fullName,
        badge_number: badgeNumber
      },
      email_confirm: true,
    });

    if (createError) {
      if (createError.message.includes('unique constraint') || createError.message.includes('should be unique')) {
        return new Response(JSON.stringify({ error: 'Um usuário com este crachá já existe.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        });
      }
      throw createError;
    }

    // ✅ 8. Retorna sucesso
    return new Response(JSON.stringify({ user: newUser }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
