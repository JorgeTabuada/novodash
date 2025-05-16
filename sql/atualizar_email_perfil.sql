-- Script SQL para atualizar o email do utilizador no perfil
-- Execute este script no SQL Editor do Supabase

-- Atualizar o utilizador com ID específico para incluir o email
UPDATE public.profiles
SET 
    email = 'jorge.g.tabuada@gmail.com'
WHERE 
    id = 'e5ddbcb5-6ffa-44b0-94c2-02fb58644ed0';

-- Verificar se a atualização foi bem-sucedida
SELECT id, full_name, role, email FROM public.profiles 
WHERE id = 'e5ddbcb5-6ffa-44b0-94c2-02fb58644ed0';
