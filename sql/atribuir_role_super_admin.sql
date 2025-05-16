-- Script SQL para atribuir o role 'super admin' ao utilizador
-- Execute este script no SQL Editor do Supabase

-- Atualizar o utilizador com ID específico para ter o role 'super admin'
UPDATE public.profiles
SET 
    role = 'super admin',
    full_name = 'Administrador'
WHERE 
    id = 'e5ddbcb5-6ffa-44b0-94c2-02fb58644ed0';

-- Verificar se a atualização foi bem-sucedida
SELECT id, full_name, role FROM public.profiles 
WHERE id = 'e5ddbcb5-6ffa-44b0-94c2-02fb58644ed0';
