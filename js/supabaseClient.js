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

// A variável global `supabase` é fornecida pela biblioteca carregada via CDN.
// Esta linha cria a instância do cliente Supabase e a torna globalmente acessível.
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Opcional: para tornar acessível globalmente via window, se necessário.
// window.supabase = supabase;

console.log("Supabase client inicializado com as credenciais fornecidas.");
if (!supabase) {
    console.error("Falha ao inicializar o Supabase client. Verifique as credenciais e a inclusão da biblioteca Supabase no HTML.");
}
