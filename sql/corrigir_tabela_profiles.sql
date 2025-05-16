-- Script SQL para corrigir a estrutura da tabela 'profiles' no Supabase
-- Execute este script no SQL Editor do Supabase

-- Verificar se a tabela 'profiles' existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles') THEN
        -- Criar a tabela 'profiles' se não existir
        CREATE TABLE public.profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id),
            full_name TEXT,
            role TEXT DEFAULT 'default',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Ativar Row Level Security (RLS)
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        -- Criar política para permitir acesso de leitura a utilizadores autenticados
        CREATE POLICY "Permitir acesso a perfis para utilizadores autenticados" 
        ON public.profiles FOR SELECT 
        TO authenticated 
        USING (true);
        
        -- Criar política para permitir que utilizadores atualizem apenas o seu próprio perfil
        CREATE POLICY "Permitir atualização do próprio perfil" 
        ON public.profiles FOR UPDATE 
        TO authenticated 
        USING (auth.uid() = id);
        
        RAISE NOTICE 'Tabela profiles criada com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela profiles já existe.';
    END IF;
END
$$;

-- Adicionar coluna 'parque_associado_id' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'profiles' 
                   AND column_name = 'parque_associado_id') THEN
        ALTER TABLE public.profiles ADD COLUMN parque_associado_id TEXT;
        RAISE NOTICE 'Coluna parque_associado_id adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna parque_associado_id já existe.';
    END IF;
END
$$;

-- Adicionar coluna 'cidades_associadas' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'profiles' 
                   AND column_name = 'cidades_associadas') THEN
        ALTER TABLE public.profiles ADD COLUMN cidades_associadas TEXT[];
        RAISE NOTICE 'Coluna cidades_associadas adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna cidades_associadas já existe.';
    END IF;
END
$$;

-- Adicionar coluna 'parques_associados_ids' se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_schema = 'public' AND table_name = 'profiles' 
                   AND column_name = 'parques_associados_ids') THEN
        ALTER TABLE public.profiles ADD COLUMN parques_associados_ids TEXT[];
        RAISE NOTICE 'Coluna parques_associados_ids adicionada com sucesso!';
    ELSE
        RAISE NOTICE 'Coluna parques_associados_ids já existe.';
    END IF;
END
$$;

-- Verificar se o utilizador atual tem um perfil e criar se não existir
DO $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Obter o ID do utilizador atual (se estiver autenticado)
    current_user_id := auth.uid();
    
    IF current_user_id IS NOT NULL THEN
        -- Verificar se o utilizador já tem um perfil
        IF NOT EXISTS (SELECT FROM public.profiles WHERE id = current_user_id) THEN
            -- Inserir um perfil para o utilizador atual com role 'super admin'
            INSERT INTO public.profiles (id, full_name, role)
            VALUES (current_user_id, 'Administrador', 'super admin');
            RAISE NOTICE 'Perfil criado para o utilizador atual com role super admin.';
        ELSE
            -- Atualizar o role para 'super admin' se necessário
            UPDATE public.profiles
            SET role = 'super admin'
            WHERE id = current_user_id AND (role IS NULL OR role != 'super admin');
            RAISE NOTICE 'Role do utilizador atual atualizado para super admin, se necessário.';
        END IF;
    ELSE
        RAISE NOTICE 'Nenhum utilizador autenticado. Execute este script enquanto estiver autenticado para criar/atualizar o seu perfil.';
    END IF;
END
$$;

-- Verificar se a tabela 'parques' existe e criar se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'parques') THEN
        -- Criar a tabela 'parques' se não existir
        CREATE TABLE public.parques (
            id_pk TEXT PRIMARY KEY,
            nome_parque TEXT NOT NULL,
            cidade TEXT,
            endereco TEXT,
            capacidade INTEGER,
            ativo BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Ativar Row Level Security (RLS)
        ALTER TABLE public.parques ENABLE ROW LEVEL SECURITY;
        
        -- Criar política para permitir acesso de leitura a utilizadores autenticados
        CREATE POLICY "Permitir acesso a parques para utilizadores autenticados" 
        ON public.parques FOR SELECT 
        TO authenticated 
        USING (true);
        
        -- Inserir alguns parques de exemplo
        INSERT INTO public.parques (id_pk, nome_parque, cidade, ativo)
        VALUES 
            ('LIS001', 'Parque Lisboa Centro', 'Lisboa', true),
            ('POR001', 'Parque Porto Baixa', 'Porto', true),
            ('FAR001', 'Parque Faro Marina', 'Faro', true);
            
        RAISE NOTICE 'Tabela parques criada com dados de exemplo!';
    ELSE
        RAISE NOTICE 'Tabela parques já existe.';
    END IF;
END
$$;

-- Verificar e atualizar as políticas RLS para garantir a segurança adequada
DO $$
BEGIN
    -- Verificar se a política de leitura existe para profiles
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Permitir acesso a perfis para utilizadores autenticados'
    ) THEN
        -- Criar política para permitir acesso de leitura a utilizadores autenticados
        CREATE POLICY "Permitir acesso a perfis para utilizadores autenticados" 
        ON public.profiles FOR SELECT 
        TO authenticated 
        USING (true);
        
        RAISE NOTICE 'Política de leitura para profiles criada.';
    END IF;
    
    -- Verificar se a política de atualização existe para profiles
    IF NOT EXISTS (
        SELECT FROM pg_policies 
        WHERE tablename = 'profiles' 
        AND policyname = 'Permitir atualização do próprio perfil'
    ) THEN
        -- Criar política para permitir que utilizadores atualizem apenas o seu próprio perfil
        CREATE POLICY "Permitir atualização do próprio perfil" 
        ON public.profiles FOR UPDATE 
        TO authenticated 
        USING (auth.uid() = id);
        
        RAISE NOTICE 'Política de atualização para profiles criada.';
    END IF;
END
$$;

-- Verificar se as colunas existem e têm o tipo correto
SELECT 
    column_name, 
    data_type 
FROM 
    information_schema.columns 
WHERE 
    table_schema = 'public' 
    AND table_name = 'profiles';

-- Listar todos os perfis existentes
SELECT * FROM public.profiles;

-- Listar todos os parques existentes
SELECT * FROM public.parques;
