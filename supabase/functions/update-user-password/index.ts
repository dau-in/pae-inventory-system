// supabase/functions/update-user-password/index.ts
// Edge Function: Cambio de contraseña de terceros (server-side)
// Usa service_role_key para invocar auth.admin.updateUserById
// SEGURIDAD: Solo accesible por usuarios autenticados con rol Director (1) o Desarrollador (4)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Headers CORS reutilizables
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 1. Validar método
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método no permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 2. Extraer el JWT del header Authorization para verificar quién llama
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No autorizado: falta token de autenticación" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 3. Crear cliente con anon key para verificar el rol del solicitante
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // 4. Obtener el usuario que hace la solicitud
    const { data: { user: caller }, error: callerError } = await supabaseAuth.auth.getUser()
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "No autorizado: sesión inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 5. Verificar que el solicitante sea Director (1) o Desarrollador (4)
    const { data: callerData, error: roleError } = await supabaseAuth
      .from("users")
      .select("id_rol")
      .eq("id_user", caller.id)
      .single()

    if (roleError || ![1, 4].includes(callerData?.id_rol)) {
      return new Response(
        JSON.stringify({ error: "Prohibido: no tienes permisos para esta operación" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 6. Parsear body
    const { userId, newPassword } = await req.json()

    if (!userId || !newPassword) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: userId y newPassword" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    if (newPassword.length < 6) {
      return new Response(
        JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 7. Crear cliente admin con service_role key y cambiar la contraseña
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (updateError) {
      console.error("[update-user-password] Error al actualizar:", updateError.message)
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // 8. Éxito
    return new Response(
      JSON.stringify({ message: "Contraseña actualizada exitosamente" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )

  } catch (err) {
    console.error("[update-user-password] Excepción:", err)
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
