// Configuração do Firebase
// Substitua as chaves abaixo pelas credenciais que você obterá no console do Firebase (https://console.firebase.google.com/)
const firebaseConfig = {
    apiKey: "AIzaSyDWkqcLNKY_mzmZac3AVBv8Dy09vG4DWRs",
    authDomain: "convitemacon.firebaseapp.com",
    projectId: "convitemacon",
    storageBucket: "convitemacon.firebasestorage.app",
    messagingSenderId: "789123486440",
    appId: "1:789123486440:web:0dbb119b92c1383b12ef5d",
    measurementId: "G-J4NGBZDLC0"
};

// Verifica se a configuração padrão foi alterada pelo usuário
const isFirebaseConfigured = firebaseConfig.projectId && firebaseConfig.projectId !== "SEU_PROJECT_ID";

let db = null;

if (isFirebaseConfigured) {
    try {
        // Inicializa o Firebase
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        console.log("Firebase conectado com sucesso!");
    } catch (error) {
        console.error("Erro ao inicializar o Firebase:", error);
    }
} else {
    console.warn("Firebase não configurado. O site está rodando no modo de armazenamento local (localStorage).");
}
