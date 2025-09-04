// Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA9r7AfToG9msI_guh8xY_PJBJXfrF_IPc",
  authDomain: "instagraneducativo.firebaseapp.com",
  projectId: "instagraneducativo",
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const videoPrincipal = document.getElementById("video-principal");
const tituloVideo = document.getElementById("titulo-video");
const descricaoVideo = document.getElementById("descricao-video");
const comentariosVideo = document.getElementById("comentarios-video");
const inputComentario = document.getElementById("input-comentario");
const btnComentar = document.getElementById("btn-comentar");
const btnProximo = document.getElementById("btn-proximo");
const sugestoesDiv = document.getElementById("sugestoes");

let videos = [];
let indiceAtual = 0;

// Autenticação anônima
async function ensureAuth() {
  if (!auth.currentUser) {
    await auth.signInAnonymously();
  }
}

// Carregar vídeos do Firebase
async function carregarVideos() {
  await ensureAuth();
  const snap = await db.collection("videos").orderBy("data", "desc").get();
  videos = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  if(videos.length > 0) mostrarVideo(indiceAtual);
}

// Mostrar vídeo atual
async function mostrarVideo(index) {
  const v = videos[index];
  if(!v) return;

  // Título e descrição
  tituloVideo.textContent = v.titulo;
  descricaoVideo.innerHTML = linkify(v.descricao || "");

  // Player YouTube (videoId)
  videoPrincipal.innerHTML = `<iframe src="https://www.youtube.com/embed/${v.videoId}" allowfullscreen></iframe>`;

  // Comentários
  const snap = await db.collection("videos").doc(v.id).collection("comentarios").orderBy("data").get();
  comentariosVideo.innerHTML = snap.docs.map(d => `<p>${linkify(d.data().texto)}</p>`).join("");

  // Sugestões (mesmas tags)
  carregarSugestoes(v.tags, v.id);
}

// Adicionar comentário
btnComentar.addEventListener("click", async () => {
  const texto = inputComentario.value.trim();
  if(!texto) return;
  const v = videos[indiceAtual];
  await db.collection("videos").doc(v.id).collection("comentarios").add({
    texto,
    data: new Date()
  });
  inputComentario.value = "";
  mostrarVideo(indiceAtual);
});

// Próximo vídeo
btnProximo.addEventListener("click", () => {
  indiceAtual = (indiceAtual + 1) % videos.length;
  mostrarVideo(indiceAtual);
});

// Sugestões
async function carregarSugestoes(tags, idPrincipal) {
  sugestoesDiv.innerHTML = "";
  if(!tags || tags.length === 0) return;

  const snap = await db.collection("videos")
    .where("tags", "array-contains-any", tags)
    .orderBy("data", "desc")
    .limit(10)
    .get();

  snap.docs.filter(d => d.id !== idPrincipal).forEach(doc => {
    const v = doc.data();
    const card = document.createElement("div");
    card.className = "sugestao-card";
    card.innerHTML = `
      <iframe src="https://www.youtube.com/embed/${v.videoId}" allowfullscreen></iframe>
      <div>${v.titulo}</div>
    `;
    sugestoesDiv.appendChild(card);
  });
}

// Transformar URLs em links clicáveis
function linkify(text) {
  if(!text) return "";
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

// Inicializar
carregarVideos();
