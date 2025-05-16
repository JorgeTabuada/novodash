// js/supabaseClient.js
// ATENÇÃO: Estas são as tuas credenciais REAIS, conforme "Linhas a Seguir.docx".
const SUPABASE_URL = "https://ioftqsvjqwjeprsckeym.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvZnRxc3ZqcXdqZXByc2NrZXltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcxNTYwNzQsImV4cCI6MjA2MjczMjA3NH0.TXDfhioMFVNxLhjKgpXAxnKCPOl5n8QWpOkX2eafbYw";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const errorMessage = "ERRO CRÍTICO: As credenciais do Supabase (SUPABASE_URL ou SUPABASE_ANON_KEY) não estão definidas em js/supabaseClient.js! A aplicação não poderá funcionar.";
    alert(errorMessage);
    console.error(errorMessage);
    // Considerar parar a execução ou mostrar um erro mais visível na página
    // document.body.innerHTML = `<div style="color: red; padding: 20px; font-size: 1.5em;">${errorMessage}</div>`;
    // throw new Error(errorMessage); // Para parar a execução de scripts subsequentes
}

// Função para inicializar o cliente Supabase de forma segura
function initSupabaseClient() {
    try {
        // Verificar se a biblioteca Supabase foi carregada
        if (typeof supabase === 'undefined') {
            console.error("ERRO CRÍTICO: A biblioteca Supabase não foi carregada. Verifique a inclusão do script do CDN.");
            return false;
        }
        
        // Inicializar o cliente Supabase e torná-lo globalmente acessível
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        console.log("Supabase client inicializado com sucesso.");
        return true;
    } catch (error) {
        console.error("ERRO ao inicializar o Supabase client:", error);
        return false;
    }
}

// Tentar inicializar imediatamente
const initSuccess = initSupabaseClient();

// Verificar se a inicialização foi bem-sucedida
if (!initSuccess || !window.supabase) {
    console.error("Falha ao inicializar o Supabase client. Verifique as credenciais e a inclusão da biblioteca Supabase no HTML.");
    
    // Tentar novamente após um curto atraso (pode ajudar em casos de carregamento assíncrono)
    setTimeout(() => {
        if (typeof supabase !== 'undefined' && !window.supabase) {
            console.log("Tentando inicializar o Supabase client novamente...");
            initSupabaseClient();
        }
    }, 500);
}

// Expor uma função para verificar se o Supabase está disponível
window.isSupabaseAvailable = function() {
    return typeof window.supabase !== 'undefined' && window.supabase !== null;
};

// Expor uma função para obter o cliente Supabase de forma segura
window.getSupabaseClient = function() {
    if (!window.isSupabaseAvailable()) {
        console.error("Tentativa de acesso ao Supabase client antes da inicialização.");
        // Tentar inicializar novamente
        initSupabaseClient();
    }
    return window.supabase;
};
