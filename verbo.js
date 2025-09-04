// 🔹 Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyA9r7AfToG9msI_guh8xY_PJBJXfrF_IPc",
  authDomain: "instagraneducativo.firebaseapp.com",
  projectId: "instagraneducativo",
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Array para armazenar os vídeos do Firebase
let videos = [];
let indiceAtual = 0;
let videoEspecialAtual = null;
let videosCarrossel = [];
const TAG_ESPECIAL = "Verbo"; // Tag fixa para filtrar os vídeos

// 🔹 Autenticação anônima
async function ensureAuth() {
  if (!auth.currentUser) {
    await auth.signInAnonymously();
    console.log("Autenticação anônima concluída.");
  }
}

// 🔹 Mostrar/Ocultar Loading
function mostrarLoading(mostrar, mensagem = "Processando...") {
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = loadingOverlay ? loadingOverlay.querySelector('span') : null;
  
  if (loadingText && mensagem) {
    loadingText.textContent = mensagem;
  }
  
  if (loadingOverlay) {
    if (mostrar) {
      loadingOverlay.classList.remove('hidden');
      setTimeout(() => {
        if (!loadingOverlay.classList.contains('hidden')) {
          const forceCloseBtn = document.getElementById('force-close-loading');
          if (forceCloseBtn) forceCloseBtn.classList.remove('hidden');
        }
      }, 8000);
    } else {
      loadingOverlay.classList.add('hidden');
      const forceCloseBtn = document.getElementById('force-close-loading');
      if (forceCloseBtn) forceCloseBtn.classList.add('hidden');
    }
  }
}

// 🔹 Sistema de Feedback Visual
function mostrarFeedback(mensagem, tipo = 'sucesso') {
  const feedbackEl = document.getElementById('feedback-global');
  const feedbackId = 'feedback-' + Date.now();
  
  const cores = {
    sucesso: 'bg-green-500 border-green-600',
    erro: 'bg-red-500 border-red-600',
    info: 'bg-blue-500 border-blue-600',
    aviso: 'bg-yellow-500 border-yellow-600'
  };
  
  const icones = {
    sucesso: '✅',
    erro: '❌',
    info: 'ℹ️',
    aviso: '⚠️'
  };
  
  const feedbackItem = document.createElement('div');
  feedbackItem.id = feedbackId;
  feedbackItem.className = `feedback-item ${cores[tipo]} mb-2`;
  feedbackItem.innerHTML = `
    <div class="flex items-center">
      <span class="mr-2 text-lg">${icones[tipo]}</span>
      <span>${mensagem}</span>
    </div>
  `;
  
  feedbackEl.appendChild(feedbackItem);
  
  setTimeout(() => {
    feedbackItem.style.transform = 'translateX(0)';
    feedbackItem.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    feedbackItem.style.transform = 'translateX(100%)';
    feedbackItem.style.opacity = '0';
    setTimeout(() => {
      if (feedbackEl.contains(feedbackItem)) {
        feedbackEl.removeChild(feedbackItem);
      }
    }, 300);
  }, 4000);
}

// 🔹 Sistema de Agendamento de Revisão
function configurarSistemaAgendamento() {
  const btnAgendar = document.getElementById('btn-agendar');
  
  btnAgendar.addEventListener('click', async () => {
    if (videos.length === 0) return;
    
    const intervalo = parseInt(document.getElementById('intervalo-revisao').value);
    const videoAtual = videos[indiceAtual];
    
    try {
      await agendarRevisao(videoAtual, intervalo);
    } catch (error) {
      console.error('Erro ao agendar revisão:', error);
      mostrarFeedback('Erro ao agendar revisão. Tente novamente.', 'erro');
    }
  });
}

// 🔹 Agendar revisão no Firebase
async function agendarRevisao(video, intervaloDias) {
  mostrarLoading(true, "Agendando revisão...");
  
  try {
    await ensureAuth();
    
    const hoje = new Date();
    const dataRevisao = new Date();
    dataRevisao.setDate(hoje.getDate() + intervaloDias);
    
    const agendamento = {
      videoId: video.id,
      titulo: video.titulo,
      descricao: video.descricao,
      dataAgendamento: firebase.firestore.Timestamp.fromDate(hoje),
      dataRevisao: firebase.firestore.Timestamp.fromDate(dataRevisao),
      intervaloDias: intervaloDias,
      tipo: 'verbo',
      realizada: false
    };
    
    // Salvar no Firestore
    await db.collection('revisoes').add(agendamento);
    
    // Remover o vídeo da lista atual (pois agora tem revisão agendada)
    videos.splice(indiceAtual, 1);
    
    if (videos.length > 0) {
      // Ajustar índice se necessário
      if (indiceAtual >= videos.length) {
        indiceAtual = videos.length - 1;
      }
      atualizarVideo();
    } else {
      // Não há mais vídeos inéditos
      document.getElementById("tituloText").textContent = "Todos os vídeos revisados!";
      document.getElementById("descricao").textContent = "Parabéns! Você agendou revisão para todos os vídeos disponíveis.";
      document.getElementById("videoFrame").src = "about:blank";
      document.getElementById("carrosselContainer").classList.add("hidden");
      document.querySelector(".agendamento-wrapper").classList.add("hidden");
    }
    
    // Feedback de sucesso
    mostrarFeedback(`Revisão agendada para ${dataRevisao.toLocaleDateString('pt-BR')} 📅`, 'sucesso');
    
  } catch (error) {
    console.error('Erro ao agendar revisão:', error);
    mostrarFeedback('Erro ao agendar revisão. Tente novamente.', 'erro');
    throw error;
  } finally {
    mostrarLoading(false);
  }
}

// 🔹 Verificar se um vídeo já tem revisão agendada
async function videoTemRevisaoAgendada(videoId) {
  try {
    await ensureAuth();
    
    const snap = await db.collection('revisoes')
      .where('videoId', '==', videoId)
      .where('realizada', '==', false)
      .limit(1)
      .get();
    
    return !snap.empty;
  } catch (error) {
    console.error('Erro ao verificar revisões:', error);
    return false;
  }
}

// 🔹 Carregar vídeos inéditos (sem revisão agendada)
async function carregarVideosIneditos() {
  try {
    mostrarLoading(true, "Carregando vídeos inéditos...");
    await ensureAuth();

    // Buscar todos os vídeos de verbo
    const snapVideos = await db.collection("videos")
      .where("tags", "array-contains", TAG_ESPECIAL)
      .orderBy("data", "desc")
      .get();

    if (snapVideos.empty) {
      document.getElementById("tituloText").textContent = "Nenhum vídeo de Verbos encontrado";
      document.getElementById("descricao").textContent = "Não há vídeos de Verbos disponíveis no momento.";
      mostrarLoading(false);
      return;
    }

    // Filtrar apenas vídeos que não têm revisão agendada
    const todosVideos = snapVideos.docs.map(doc => {
      const data = doc.data();
      return {
        id: data.videoId,
        titulo: data.titulo,
        descricao: data.descricao || "",
        tags: data.tags || [],
        especial: data.especial || false
      };
    });

    // Verificar cada vídeo para ver se já tem revisão agendada
    videos = [];
    for (const video of todosVideos) {
      const temRevisao = await videoTemRevisaoAgendada(video.id);
      if (!temRevisao) {
        videos.push(video);
        
        // Limitar a 10 vídeos para performance
        if (videos.length >= 10) break;
      }
    }

    console.log("Vídeos inéditos encontrados:", videos.length);

    if (videos.length === 0) {
      document.getElementById("tituloText").textContent = "Todos os vídeos revisados!";
      document.getElementById("descricao").textContent = "Parabéns! Você já agendou revisão para todos os vídeos disponíveis. Novos vídeos aparecerão aqui quando disponíveis.";
      document.querySelector(".agendamento-wrapper").classList.add("hidden");
      mostrarLoading(false);
      return;
    }

    // Separar vídeo especial (se houver) e carregar carrossel
    videoEspecialAtual = videos.find(v => v.especial) || videos[0];
    await carregarVideosCarrossel();
    atualizarVideo();
    
  } catch (e) {
    console.error("Erro ao carregar vídeos inéditos:", e);
    document.getElementById("tituloText").textContent = "Erro ao carregar vídeos";
    document.getElementById("descricao").textContent = "Verifique sua conexão e tente novamente.";
    mostrarFeedback("Erro ao carregar vídeos. Verifique sua conexão.", "erro");
  } finally {
    mostrarLoading(false);
  }
}

// 🔹 Carregar vídeos para o carrossel de histórico (apenas inéditos)
async function carregarVideosCarrossel() {
  try {
    // Usar os vídeos já carregados, mas excluir o atual
    videosCarrossel = videos.filter(video => video.id !== videoEspecialAtual.id);
    
    // Se não há vídeos suficientes, buscar mais
    if (videosCarrossel.length < 3) {
      const snapExtra = await db.collection("videos")
        .where("tags", "array-contains", TAG_ESPECIAL)
        .where("especial", "==", false)
        .orderBy("data", "desc")
        .limit(5)
        .get();
      
      const videosExtra = snapExtra.docs.map(doc => {
        const data = doc.data();
        return {
          id: data.videoId,
          titulo: data.titulo,
          descricao: data.descricao || "",
          tags: data.tags || [],
          especial: false
        };
      });
      
      // Adicionar apenas vídeos que não estão na lista principal e não têm revisão
      for (const video of videosExtra) {
        if (videosCarrossel.length >= 6) break;
        if (!videos.find(v => v.id === video.id) && !videosCarrossel.find(v => v.id === video.id)) {
          const temRevisao = await videoTemRevisaoAgendada(video.id);
          if (!temRevisao) {
            videosCarrossel.push(video);
          }
        }
      }
    }

    if (videosCarrossel.length > 0) {
      renderizarCarrossel();
      document.getElementById("carrosselContainer").classList.remove("hidden");
    } else {
      document.getElementById("carrosselContainer").classList.add("hidden");
    }
    
  } catch (e) {
    console.error("Erro ao carregar carrossel:", e);
    document.getElementById("carrosselContainer").classList.add("hidden");
  }
}

// 🔹 Renderizar carrossel de histórico
function renderizarCarrossel() {
  const carrosselEl = document.getElementById("carrosselHistorico");
  carrosselEl.innerHTML = "";

  videosCarrossel.forEach(video => {
    const item = document.createElement("div");
    item.className = "carrossel-item";
    item.innerHTML = `
      <div class="carrossel-video">
        <iframe 
          src="https://www.youtube.com/embed/${video.id}?modestbranding=1&controls=0"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
      </div>
      <div class="carrossel-titulo">${video.titulo}</div>
      <div class="carrossel-link" data-video-id="${video.id}">Carregar como principal</div>
    `;
    
    carrosselEl.appendChild(item);
  });
  
  document.querySelectorAll('.carrossel-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      const videoId = e.target.getAttribute('data-video-id');
      carregarVideoComoPrincipal(videoId);
    });
  });
}

// 🔹 Carregar vídeo do carrossel como vídeo principal
function carregarVideoComoPrincipal(videoId) {
  const videoIndex = videos.findIndex(v => v.id === videoId);
  
  if (videoIndex !== -1) {
    indiceAtual = videoIndex;
    videoEspecialAtual = videos[videoIndex];
  } else {
    const videoCarrossel = videosCarrossel.find(v => v.id === videoId);
    if (videoCarrossel) {
      videos.unshift(videoCarrossel);
      indiceAtual = 0;
      videoEspecialAtual = videoCarrossel;
    }
  }
  
  atualizarVideo();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  mostrarFeedback("Vídeo carregado com sucesso", "info");
}

function transformarLinks(texto){
  if(!texto) return '';
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g;
  return texto.replace(urlRegex, (url) => {
    const href = url.startsWith('http') ? url : 'https://' + url;
    return `<a href=\"${href}\" target=\"_blank\" class=\"link\">${url}</a>`;
  });
}

function salvarComentarios(idVideo, comentarios){
  localStorage.setItem("comentarios_" + idVideo, JSON.stringify(comentarios));
}

function carregarComentarios(idVideo){
  const dados = localStorage.getItem("comentarios_" + idVideo);
  return dados ? JSON.parse(dados) : [];
}

function renderizarComentarios(){
  const comentariosDiv = document.getElementById('comentarios');
  comentariosDiv.innerHTML = "";
  
  if (videos.length === 0) {
    comentariosDiv.innerHTML = "<p class='text-gray-400 text-center'>Nenhum vídeo carregado</p>";
  }
  
  const comentarios = carregarComentarios(videos[indiceAtual].id);
  
  if (comentarios.length === 0) {
    comentariosDiv.innerHTML = "<p class='text-gray-400 text-center'>Nenhum comentário ainda. Seja o primeiro a comentar!</p>";
    return;
  }
  
  comentarios.forEach(texto => {
    const novoComentario = document.createElement('p');
    novoComentario.className = "bg-zinc-800 p-2 rounded-xl";
    novoComentario.innerHTML = transformarLinks(texto);
    comentariosDiv.appendChild(novoComentario);
  });
}

function adicionarComentario(){
  if (videos.length === 0) return;
  
  const input = document.getElementById('inputComentario');
  const valor = input.value.trim();
  if(valor !== ""){
    const comentarios = carregarComentarios(videos[indiceAtual].id);
    comentarios.push(valor);
    salvarComentarios(videos[indiceAtual].id, comentarios);
    renderizarComentarios();
    input.value = "";
    mostrarFeedback('Comentário adicionado! 💬', 'sucesso');
  } else {
    mostrarFeedback('Digite um comentário antes de enviar.', 'aviso');
  }
}

function atualizarDescricao(texto){
  const descricaoEl = document.getElementById("descricao");
  descricaoEl.innerHTML = transformarLinks(texto);
}

function atualizarTitulo(titulo){
  document.getElementById("tituloText").textContent = titulo;
}

function atualizarVideo() {
  if (videos.length === 0) return;
  
  const videoFrame = document.getElementById("videoFrame");
  videoFrame.src = `https://www.youtube.com/embed/${videos[indiceAtual].id}?autoplay=1&modestbranding=1&controls=1`;
  atualizarDescricao(videos[indiceAtual].descricao);
  atualizarTitulo(videos[indiceAtual].titulo);
  renderizarComentarios();
}

function proximoVideo(){
  if (videos.length === 0) return;
  
  indiceAtual = (indiceAtual + 1) % videos.length;
  videoEspecialAtual = videos[indiceAtual];
  atualizarVideo();
  mostrarFeedback("Próximo vídeo carregado", "info");
}

// 🔹 Botão de emergência para fechar o loading manualmente
function setupForceCloseButton() {
  const forceCloseBtn = document.getElementById('force-close-loading');
  if (forceCloseBtn) {
    forceCloseBtn.addEventListener('click', function() {
      mostrarLoading(false);
      mostrarFeedback('Loading fechado manualmente', 'aviso');
    });
  }
}

// 🔹 Tratamento global de erros
window.addEventListener('error', function() {
  mostrarLoading(false);
});

window.addEventListener('unhandledrejection', function() {
  mostrarLoading(false);
});

// Inicializar a página
document.addEventListener('DOMContentLoaded', async function() {
  const btnComentario = document.getElementById('btnComentario');
  const btnProximo = document.getElementById('btnProximo');
  const inputComentario = document.getElementById('inputComentario');
  
  if (btnComentario) btnComentario.addEventListener('click', adicionarComentario);
  if (btnProximo) btnProximo.addEventListener('click', proximoVideo);
  
  if (inputComentario) {
    inputComentario.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') adicionarComentario();
    });
  }

  configurarSistemaAgendamento();
  setupForceCloseButton();
  
  // Carregar vídeos inéditos (sem revisão agendada)
  await carregarVideosIneditos();
});