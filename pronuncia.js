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
const TAG_ESPECIAL = "Pronuncia"; // Tag fixa para filtrar os vídeos

// Variável para controlar o comentário sendo editado
let comentarioEditando = null;

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
  feedbackItem.className = `feedback-item ${cores[tipo]} mb-2 p-3 rounded-lg border-l-4 transition-all duration-300 transform translate-x-full opacity-0`;
  feedbackItem.innerHTML = `
    <div class="flex items-center">
      <span class="mr-2 text-lg">${icones[tipo]}</span>
      <span>${mensagem}</span>
    </div>
  `;
  
  feedbackEl.appendChild(feedbackItem);
  
  setTimeout(() => {
    feedbackItem.classList.remove('translate-x-full');
    feedbackItem.classList.remove('opacity-0');
    feedbackItem.classList.add('translate-x-0');
    feedbackItem.classList.add('opacity-100');
  }, 10);
  
  setTimeout(() => {
    feedbackItem.classList.remove('translate-x-0');
    feedbackItem.classList.remove('opacity-100');
    feedbackItem.classList.add('translate-x-full');
    feedbackItem.classList.add('opacity-0');
    setTimeout(() => {
      if (feedbackEl.contains(feedbackItem)) {
        feedbackEl.removeChild(feedbackItem);
      }
    }, 300);
  }, 4000);
}

// 🔹 Função para salvar comentários no Firebase (corrigida)
async function salvarComentario(comentarioTexto, videoId, usuario = 'Anônimo', comentarioId = null) {
  try {
    mostrarLoading(true, comentarioId ? "Editando comentário..." : "Salvando comentário...");
    
    if (comentarioId) {
      // 🔹 EDITAR comentário existente
      await db.collection('comentarios').doc(comentarioId).update({
        texto: comentarioTexto,
        // REMOVER os campos de edição: editado e dataEdicao
      });
    } else {
      // 🔹 NOVO comentário
      await db.collection('comentarios').add({
        texto: comentarioTexto,
        videoId: videoId,
        usuario: usuario,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        data: new Date().toLocaleString('pt-BR')
      });
    }
    
    // Feedback de sucesso
    mostrarFeedback(comentarioId ? 'Comentário editado com sucesso!' : 'Comentário salvo com sucesso!', 'sucesso');
    
    // Limpar campo de input
    document.getElementById('inputComentario').value = '';
    
    // Recarregar comentários
    await carregarComentarios(videoId);
    
  } catch (error) {
    console.error('Erro ao salvar comentário:', error);
    mostrarFeedback('Erro ao salvar comentário: ' + error.message, 'erro');
  } finally {
    // Ocultar loading
    mostrarLoading(false);
  }
}






// 🔹 Função para editar comentário no Firebase (CORRIGIDA)
async function editarComentario(comentarioId, novoTexto) {
  try {
    // Usar a função salvarComentario com o ID existente
    await salvarComentario(novoTexto, videos[indiceAtual].id, 'Anônimo', comentarioId);
    
    // 🔹 Restaurar o botão CORRETAMENTE
    restaurarBotaoComentario();
    
  } catch (error) {
    console.error('Erro ao editar comentário:', error);
    mostrarFeedback('Erro ao editar comentário: ' + error.message, 'erro');
  }
}

// 🔹 Função para restaurar o botão de comentário para o estado original
function restaurarBotaoComentario() {
  const btnComentario = document.getElementById('btnComentario');
  const novoBtn = btnComentario.cloneNode(true);
  btnComentario.parentNode.replaceChild(novoBtn, btnComentario);
  
  novoBtn.innerHTML = '➕';
  novoBtn.onclick = adicionarComentario;
  
  // Resetar estado de edição
  comentarioEditando = null;
  document.getElementById('inputComentario').value = '';
}








// 🔹 Função para excluir comentário do Firebase
async function excluirComentario(comentarioId) {
  try {
    mostrarLoading(true, "Excluindo comentário...");
    
    // Excluir documento da coleção 'comentarios'
    await db.collection('comentarios').doc(comentarioId).delete();
    
    // Feedback de sucesso
    mostrarFeedback('Comentário excluído com sucesso!', 'sucesso');
    
    // Recarregar comentários
    await carregarComentarios(videos[indiceAtual].id);
    
  } catch (error) {
    console.error('Erro ao excluir comentário:', error);
    mostrarFeedback('Erro ao excluir comentário: ' + error.message, 'erro');
  } finally {
    mostrarLoading(false);
  }
}





// 🔹 Função para carregar comentários do Firebase
async function carregarComentarios(videoId) {
  try {
    const comentariosContainer = document.getElementById('comentarios');
    comentariosContainer.innerHTML = '<p class="text-gray-400 text-center">Carregando comentários...</p>';
    
    // Buscar comentários para o vídeo atual
    const snapshot = await db.collection('comentarios')
      .where('videoId', '==', videoId)
      .orderBy('timestamp', 'desc')
      .get();
    
    comentariosContainer.innerHTML = '';
    
    if (snapshot.empty) {
      comentariosContainer.innerHTML = '<p class="text-gray-400 text-center">Nenhum comentário ainda. Seja o primeiro a comentar!</p>';
      return;
    }
    
    snapshot.forEach(doc => {
      const comentario = doc.data();
      comentario.id = doc.id; // Adicionar o ID do documento
      const comentarioElement = criarElementoComentario(comentario);
      comentariosContainer.appendChild(comentarioElement);
    });
  } catch (error) {
    console.error('Erro ao carregar comentários:', error);
    const comentariosContainer = document.getElementById('comentarios');
    comentariosContainer.innerHTML = '<p class="text-red-400 text-center">Erro ao carregar comentários.</p>';
  }
}

// 🔹 Função para transformar URLs em links clicáveis
function transformarLinks(texto) {
  if (!texto) return '';
  
  // Regex para detectar URLs (http, https, www)
  const urlRegex = /(\b(https?|ftp):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]|www\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  
  return texto.replace(urlRegex, (url) => {
    let href = url;
    if (!url.startsWith('http')) {
      href = 'https://' + url;
    }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">${url}</a>`;
  });
}






// 🔹 Versão com limite de altura e botão "Ver mais"
function criarElementoComentario(comentario) {
  const div = document.createElement('div');
  div.className = 'comentario bg-zinc-800 p-3 rounded-xl mb-2';
  
  const isLongComment = comentario.texto.length > 200;
  const displayText = isLongComment ? comentario.texto.substring(0, 200) + '...' : comentario.texto;
  
  div.innerHTML = `
    <div class="grid grid-cols-1 gap-2">
      <div class="comentario-texto relative">
        <p class="text-sm text-white break-words">${transformarLinks(displayText)}</p>
        ${isLongComment ? `
          <button class="text-blue-400 text-xs mt-1 hover:underline ver-mais-btn">
            Ver mais
          </button>
        ` : ''}
      </div>
      <div class="flex justify-between items-center">
        <div class="flex space-x-1">
          <button class="btn-editar-comentario p-1 text-blue-400 hover:text-blue-300 bg-blue-900 bg-opacity-50 rounded" data-id="${comentario.id}" data-texto="${comentario.texto}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button class="btn-excluir-comentario p-1 text-red-400 hover:text-red-300 bg-red-900 bg-opacity-50 rounded" data-id="${comentario.id}">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Adicionar event listeners
  const btnEditar = div.querySelector('.btn-editar-comentario');
  const btnExcluir = div.querySelector('.btn-excluir-comentario');
  const verMaisBtn = div.querySelector('.ver-mais-btn');
  
  btnEditar.addEventListener('click', () => {
    const comentarioId = btnEditar.getAttribute('data-id');
    const comentarioTexto = btnEditar.getAttribute('data-texto');
    iniciarEdicaoComentario(comentarioId, comentarioTexto);
  });
  
  btnExcluir.addEventListener('click', () => {
    const comentarioId = btnExcluir.getAttribute('data-id');
    confirmarExclusaoComentario(comentarioId);
  });
  
  if (verMaisBtn) {
    verMaisBtn.addEventListener('click', () => {
      const textoCompleto = div.querySelector('p');
      textoCompleto.innerHTML = transformarLinks(comentario.texto);
      verMaisBtn.style.display = 'none';
    });
  }
  
  return div;
}
  





// 🔹 Função para iniciar a edição de um comentário (CORRIGIDA)
function iniciarEdicaoComentario(comentarioId, comentarioTexto) {
  comentarioEditando = comentarioId;
  const inputComentario = document.getElementById('inputComentario');
  const btnComentario = document.getElementById('btnComentario');
  
  // Preencher o input com o texto do comentário
  inputComentario.value = comentarioTexto;
  inputComentario.focus();
  
  // 🔹 REMOVER todos os event listeners anteriores primeiro
  const novoBtn = btnComentario.cloneNode(true);
  btnComentario.parentNode.replaceChild(novoBtn, btnComentario);
  
  // Alterar o botão para modo edição
  novoBtn.innerHTML = '💾';
  novoBtn.onclick = function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const novoTexto = inputComentario.value.trim();
    if (novoTexto) {
      editarComentario(comentarioId, novoTexto);
    } else {
      mostrarFeedback('O comentário não pode estar vazio.', 'aviso');
    }
    return false;
  };
  
  mostrarFeedback('Modo de edição ativado. Edite o comentário e clique em salvar.', 'info');
}






// 🔹 Função para confirmar exclusão de comentário
function confirmarExclusaoComentario(comentarioId) {
  if (confirm('Tem certeza que deseja excluir este comentário?')) {
    excluirComentario(comentarioId);
  }
}







// 🔹 Função para adicionar comentário (SIMPLIFICADA)
async function adicionarComentario() {
  if (videos.length === 0) return;
  
  const input = document.getElementById('inputComentario');
  const comentarioTexto = input.value.trim();
  
  if (comentarioTexto !== "") {
    try {
      // Obter o ID do vídeo atual
      const videoId = videos[indiceAtual].id;
      
      // Salvar o comentário no Firebase (novo comentário)
      await salvarComentario(comentarioTexto, videoId);
      
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      mostrarFeedback("Erro ao salvar comentário. Tente novamente.", "erro");
    }
  } else {
    mostrarFeedback("Digite um comentário antes de enviar.", "aviso");
  }
}


// 🔹 Função para adicionar comentário (usando Firebase)
async function adicionarComentario() {
  if (videos.length === 0) return;
  
  const input = document.getElementById('inputComentario');
  const comentarioTexto = input.value.trim();
  
  if (comentarioTexto !== "") {
    try {
      // Obter o ID do vídeo atual
      const videoId = videos[indiceAtual].id;
      
      // Salvar o comentário no Firebase (novo comentário)
      await salvarComentario(comentarioTexto, videoId);
      
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      mostrarFeedback("Erro ao salvar comentário. Tente novamente.", "erro");
    }
  } else {
    mostrarFeedback("Digite um comentário antes de enviar.", "aviso");
  }
}

// 🔹 Gerenciador de evento do Enter (CORRIGIDO)
function configurarEventoEnter() {
  const inputComentario = document.getElementById('inputComentario');
  
  if (!inputComentario) {
    console.error('Input de comentário não encontrado!');
    return;
  }
  
  // Remover event listeners anteriores
  const novoInput = inputComentario.cloneNode(true);
  inputComentario.parentNode.replaceChild(novoInput, inputComentario);
  
  novoInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (comentarioEditando) {
        // Se está editando, chama a função de edição
        const novoTexto = this.value.trim();
        if (novoTexto) {
          editarComentario(comentarioEditando, novoTexto);
        }
      } else {
        // Se não está editando, chama a função de adicionar
        adicionarComentario();
      }
      return false;
    }
  });
}

// 🔹 Função para renderizar comentários
function renderizarComentarios(){
  const comentariosDiv = document.getElementById('comentarios');
  comentariosDiv.innerHTML = "";
  
  if (videos.length === 0) {
    comentariosDiv.innerHTML = "<p class='text-gray-400 text-center'>Nenhum vídeo carregado</p>";
    return;
  }
  
  // Carregar comentários do Firebase para o vídeo atual
  carregarComentarios(videos[indiceAtual].id);
}


// 🔹 Função para renderizar comentários
function renderizarComentarios(){
  const comentariosDiv = document.getElementById('comentarios');
  comentariosDiv.innerHTML = "";
  
  if (videos.length === 0) {
    comentariosDiv.innerHTML = "<p class='text-gray-400 text-center'>Nenhum vídeo carregado</p>";
    return;
  }
  
  // Carregar comentários do Firebase para o vídeo atual
  carregarComentarios(videos[indiceAtual].id);
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
      tipo: 'pronuncia',
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
      document.getElementById("agendamento-wrapper").classList.add("hidden");
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

    // Buscar todos os vídeos de pronúncia
    const snapVideos = await db.collection("videos")
      .where("tags", "array-contains", TAG_ESPECIAL)
      .orderBy("data", "desc")
      .get();

    if (snapVideos.empty) {
      document.getElementById("tituloText").textContent = "Nenhum vídeo de Pronúncia encontrado";
      document.getElementById("descricao").textContent = "Não há vídeos de Pronúncia disponíveis no momento.";
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
      document.getElementById("agendamento-wrapper").classList.add("hidden");
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
// Inicialização SIMPLIFICADA e FUNCIONAL
document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM carregado, iniciando...');
  
  // Configurações básicas
  const btnComentario = document.getElementById('btnComentario');
  const inputComentario = document.getElementById('inputComentario');
  const btnProximo = document.getElementById('btnProximo');
  
  // Evento do botão de comentário
  if (btnComentario) {
    btnComentario.onclick = function(e) {
      e.preventDefault();
      if (comentarioEditando) {
        const texto = inputComentario.value.trim();
        if (texto) editarComentario(comentarioEditando, texto);
      } else {
        adicionarComentario();
      }
      return false;
    };
  }
  
  // Evento do Enter no input
  if (inputComentario) {
    inputComentario.onkeypress = function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (comentarioEditando) {
          const texto = this.value.trim();
          if (texto) editarComentario(comentarioEditando, texto);
        } else {
          adicionarComentario();
        }
        return false;
      }
    };
  }
  
  // Evento do botão próximo
  if (btnProximo) {
    btnProximo.onclick = proximoVideo;
  }
  
  // Configurar outros sistemas
  configurarSistemaAgendamento();
  setupForceCloseButton();
  
  // Carregar vídeos
  console.log('Carregando vídeos...');
  await carregarVideosIneditos();
  console.log('Vídeos carregados!');
});