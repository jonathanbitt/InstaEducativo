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

// Array para armazenar as revisões do dia
let revisoesPendentes = [];
let revisaoAtualIndex = 0;
let revisaoAtualId = null;

// Variável para controlar o comentário sendo editado
let comentarioEditando = null;

// Variável global para controlar se já está processando um comentário
let processandoComentario = false;

// 🔹 Autenticação anônima
async function ensureAuth() {
  if (!auth.currentUser) {
    await auth.signInAnonymously();
    console.log("Autenticação anônima concluída.");
  }
}

// 🔹 Mostrar/Ocultar Loading (CORRIGIDO)
function mostrarLoading(mostrar, mensagem = "Processando...") {
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingText = loadingOverlay ? loadingOverlay.querySelector('span') : null;
  
  if (loadingText && mensagem) {
    loadingText.textContent = mensagem;
  }
  
  if (loadingOverlay) {
    if (mostrar) {
      loadingOverlay.classList.remove('hidden');
      // Mostrar botão de emergência após 8 segundos
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

// 🔹 Função para editar comentário no Firebase (versão simplificada)
async function editarComentario(comentarioId, novoTexto) {
  if (processandoComentario) return;
  
  processandoComentario = true;
  try {
    // Usar a função salvarComentario com o ID existente
    await salvarComentario(novoTexto, revisoesPendentes[revisaoAtualIndex].videoId, 'Anônimo', comentarioId);
    
    // Resetar estado de edição
    comentarioEditando = null;
    document.getElementById('btnComentario').innerHTML = '➕';
    
  } catch (error) {
    console.error('Erro ao editar comentário:', error);
    mostrarFeedback('Erro ao editar comentário: ' + error.message, 'erro');
  }
  processandoComentario = false;
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
    await carregarComentarios(revisoesPendentes[revisaoAtualIndex].videoId);
    
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


// 🔹 Função para criar elemento de comentário (COM LINKS CLICÁVEIS)
function criarElementoComentario(comentario) {
  const div = document.createElement('div');
  div.className = 'comentario bg-zinc-800 p-3 rounded-xl mb-2 relative';
  div.innerHTML = `
    <p class="text-sm text-white mb-2">${transformarLinks(comentario.texto)}</p>
    <div class="absolute top-2 right-2 flex space-x-1">
      <button class="btn-editar-comentario p-1 text-blue-400 hover:text-blue-300" data-id="${comentario.id}" data-texto="${comentario.texto}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button class="btn-excluir-comentario p-1 text-red-400 hover:text-red-300" data-id="${comentario.id}">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  `;
  
  // Adicionar event listeners para os botões de editar e excluir
  const btnEditar = div.querySelector('.btn-editar-comentario');
  const btnExcluir = div.querySelector('.btn-excluir-comentario');
  
  btnEditar.addEventListener('click', () => {
    const comentarioId = btnEditar.getAttribute('data-id');
    const comentarioTexto = btnEditar.getAttribute('data-texto');
    iniciarEdicaoComentario(comentarioId, comentarioTexto);
  });
  
  btnExcluir.addEventListener('click', () => {
    const comentarioId = btnExcluir.getAttribute('data-id');
    confirmarExclusaoComentario(comentarioId);
  });
  
  return div;
}




// 🔹 Função para iniciar a edição de um comentário
function iniciarEdicaoComentario(comentarioId, comentarioTexto) {
  comentarioEditando = comentarioId;
  const inputComentario = document.getElementById('inputComentario');
  const btnComentario = document.getElementById('btnComentario');
  
  // Preencher o input com o texto do comentário
  inputComentario.value = comentarioTexto;
  inputComentario.focus();
  
  // Alterar o botão para modo edição
  btnComentario.innerHTML = '💾';
  btnComentario.onclick = () => {
    const novoTexto = inputComentario.value.trim();
    if (novoTexto) {
      editarComentario(comentarioId, novoTexto);
    } else {
      mostrarFeedback('O comentário não pode estar vazio.', 'aviso');
    }
  };
  
  mostrarFeedback('Modo de edição ativado. Edite o comentário e clique em salvar.', 'info');
}

// 🔹 Função para confirmar exclusão de comentário
function confirmarExclusaoComentario(comentarioId) {
  if (confirm('Tem certeza que deseja excluir este comentário?')) {
    excluirComentario(comentarioId);
  }
}

// 🔹 Função para adicionar comentário (usando Firebase)
async function adicionarComentario() {
  if (revisoesPendentes.length === 0 || processandoComentario) return;
  
  processandoComentario = true;
  const input = document.getElementById('inputComentario');
  const comentarioTexto = input.value.trim();
  
  if (comentarioTexto !== "") {
    try {
      // Obter o ID do vídeo atual
      const videoId = revisoesPendentes[revisaoAtualIndex].videoId;
      
      // Salvar o comentário no Firebase (novo comentário)
      await salvarComentario(comentarioTexto, videoId);
      
    } catch (error) {
      console.error("Erro ao adicionar comentário:", error);
      mostrarFeedback("Erro ao salvar comentário. Tente novamente.", "erro");
    }
  } else {
    mostrarFeedback("Digite um comentário antes de enviar.", "aviso");
  }
  
  processandoComentario = false;
}

// 🔹 Gerenciador de evento do Enter
function configurarEventoEnter() {
  const inputComentario = document.getElementById('inputComentario');
  
  if (!inputComentario) return;
  
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
function renderizarComentarios(videoId){
  // Carregar comentários do Firebase para o vídeo atual
  carregarComentarios(videoId);
}





async function carregarRevisoesDoDia() {
  try {
    mostrarLoading(true, "Carregando revisões...");
    await ensureAuth();

    const hoje = new Date();
    
    // Buscar TODAS as revisões não realizadas (independente da data)
    const snap = await db.collection('revisoes')
      .where('realizada', '==', false)
      .orderBy('dataRevisao', 'asc') // Ordenar no Firebase
      .get();

    console.log("Revisões pendentes encontradas:", snap.size);

    if (snap.empty) {
      document.getElementById("tituloText").textContent = "Nenhuma revisão pendente";
      document.getElementById("descricao").textContent = "Parabéns! Você não tem revisões pendentes.";
      document.getElementById("listaRevisoesContainer").classList.add("hidden");
      return;
    }

    // Transformar dados SEM filtro adicional
    revisoesPendentes = snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        videoId: data.videoId,
        titulo: data.titulo,
        descricao: data.descricao || "Sem descrição",
        dataAgendamento: data.dataAgendamento ? data.dataAgendamento.toDate() : new Date(),
        dataRevisao: data.dataRevisao ? data.dataRevisao.toDate() : new Date(),
        intervaloDias: data.intervaloDias || 3,
        realizada: data.realizada || false,
        tipo: data.tipo || 'revisao'
      };
    });

    console.log("Revisões após transformação:", revisoesPendentes.length);
    
    // Atualizar interface
    document.getElementById("contador-revisoes").textContent = `${revisoesPendentes.length} pendentes`;
    
    if (revisoesPendentes.length > 0) {
      carregarRevisaoAtual();
      carregarListaRevisoes();
    }

  } catch (e) {
    console.error("Erro ao carregar revisões:", e);
    mostrarFeedback("Erro ao carregar revisões. Verifique sua conexão.", "erro");
  } finally {
    mostrarLoading(false);
  }
}








// 🔹 Função para detectar formato do vídeo e gerar thumbnail apropriada
function gerarThumbnailInteligente(videoId, titulo, isCarrossel = false) {
  return new Promise((resolve) => {
    // Criar elemento de imagem para testar as dimensões
    const img = new Image();
    
    // URL da thumbnail de máxima resolução do YouTube
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    
    img.onload = function() {
      // Verificar se é retrato (altura > largura)
      const isRetrato = this.naturalHeight > this.naturalWidth;
      
      // Determinar classes CSS baseadas no formato
      let classes = '';
      let containerClasses = '';
      
      if (isRetrato) {
        // Formato retrato (Instagram/TikTok)
        classes = 'w-full h-64 object-cover'; // 9:16 aspect ratio aproximado
        containerClasses = 'flex justify-center';
      } else {
        // Formato paisagem (YouTube tradicional)
        classes = 'w-full h-40 object-cover'; // 16:9 aspect ratio
        containerClasses = '';
      }
      
      // Se for para o carrossel, ajustar tamanhos
      if (isCarrossel) {
        if (isRetrato) {
          classes = 'w-full h-48 object-cover'; // Tamanho menor para carrossel
        } else {
          classes = 'w-full h-32 object-cover'; // Tamanho menor para carrossel
        }
      }
      
      const thumbnailHTML = `
        <div class="${containerClasses}">
          <img src="${thumbnailUrl}" 
               alt="${titulo}"
               class="${classes} rounded-lg cursor-pointer"
               onerror="this.src='https://img.youtube.com/vi/${videoId}/hqdefault.jpg'"
               data-video-id="${videoId}">
        </div>
        <div class="carrossel-titulo mt-2">${titulo}</div>
      `;
      
      resolve(thumbnailHTML);
    };
    
    img.onerror = function() {
      // Fallback para thumbnail padrão se maxresdefault não existir
      const fallbackThumbnail = `
        <img src="https://img.youtube.com/vi/${videoId}/hqdefault.jpg" 
             alt="${titulo}"
             class="w-full h-40 object-cover rounded-lg cursor-pointer"
             data-video-id="${videoId}">
        <div class="carrossel-titulo mt-2">${titulo}</div>
      `;
      resolve(fallbackThumbnail);
    };
    
    img.src = thumbnailUrl;
  });
}



// 🔹 Carregar revisão atual
function carregarRevisaoAtual() {
  if (revisoesPendentes.length === 0) return;

  const revisao = revisoesPendentes[revisaoAtualIndex];
  revisaoAtualId = revisao.id;

  const videoFrame = document.getElementById("videoFrame");
  videoFrame.src = `https://www.youtube.com/embed/${revisao.videoId}?autoplay=1&modestbranding=1&controls=1`;

  document.getElementById("tituloText").textContent = revisao.titulo;
  document.getElementById("descricao").textContent = revisao.descricao;

  const hoje = new Date();
  const diasAtraso = Math.floor((hoje - revisao.dataRevisao) / (1000 * 60 * 60 * 24));
  const infoText = `Agendado para: ${revisao.dataRevisao.toLocaleDateString('pt-BR')} (${revisao.intervaloDias} dias)`;
  
  document.getElementById("info-agendamento").textContent = infoText;

  if (diasAtraso > 0) {
    document.getElementById("dias-atraso").textContent = `Atrasado: ${diasAtraso} dia(s)`;
    document.getElementById("dias-atraso").classList.remove("hidden");
  } else {
    document.getElementById("dias-atraso").classList.add("hidden");
  }

  renderizarComentarios(revisao.videoId);
}

// 🔹 Carregar lista de revisões na sidebar
// 🔹 Carregar lista de revisões na sidebar (COM THUMBNAILS INTELIGENTES)
async function carregarListaRevisoes() {
  const listaEl = document.getElementById("listaRevisoes");
  if (!listaEl) return;
  
  listaEl.innerHTML = '<p class="text-gray-400 text-center">Carregando...</p>';

  // Carregar todas as thumbnails primeiro
  const thumbnailsPromises = revisoesPendentes.map(async (revisao, index) => {
    const hoje = new Date();
    const diasAtraso = Math.floor((hoje - revisao.dataRevisao) / (1000 * 60 * 60 * 24));
    const atrasoText = diasAtraso > 0 ? ` (${diasAtraso} dias atrasado)` : '';
    
    const thumbnailHTML = await gerarThumbnailInteligente(revisao.videoId, revisao.titulo, true);
    

    return `
      <div class="carrossel-item ${index === revisaoAtualIndex ? 'bg-blue-800' : 'bg-gray-700'} p-3 rounded-lg">
        ${thumbnailHTML}
        <!-- Tipo do vídeo -->
        <div class="text-sm font-bold text-blue-300 mt-2 truncate">
          ${revisao.tipo || revisao.titulo}
        </div>
        <!-- Data -->
        <div class="text-xs text-gray-300 mt-1">
          Para: ${revisao.dataRevisao.toLocaleDateString('pt-BR')}${atrasoText}
        </div>
        <button class="carrossel-link mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs w-full" data-index="${index}">
          Selecionar
        </button>
      </div>
    `;
  });

  try {
    const thumbnailsHTML = await Promise.all(thumbnailsPromises);
    listaEl.innerHTML = thumbnailsHTML.join('');
    
    // Adicionar event listeners após carregar tudo
    document.querySelectorAll('.carrossel-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'));
        revisaoAtualIndex = index;
        carregarRevisaoAtual();
        mostrarFeedback("Revisão selecionada", "info");
      });
    });

    // Adicionar clique direto na thumbnail
    document.querySelectorAll('.carrossel-item img').forEach(img => {
      img.addEventListener('click', (e) => {
        const index = parseInt(e.target.closest('.carrossel-item').querySelector('.carrossel-link').getAttribute('data-index'));
        revisaoAtualIndex = index;
        carregarRevisaoAtual();
        mostrarFeedback("Revisão selecionada", "info");
      });
    });
    
  } catch (error) {
    console.error('Erro ao carregar thumbnails:', error);
    listaEl.innerHTML = '<p class="text-red-400 text-center">Erro ao carregar lista</p>';
  }
}




// 🔹 Marcar revisão como realizada (CORRIGIDO - com finally)
async function marcarComoRevisado() {
  if (!revisaoAtualId) return;

  try {
    mostrarLoading(true, "Marcando como revisado...");
    await ensureAuth();

    await db.collection('revisoes').doc(revisaoAtualId).update({
      realizada: true,
      dataRealizacao: firebase.firestore.Timestamp.fromDate(new Date())
    });

    mostrarFeedback('Revisão marcada como concluída! ✅', 'sucesso');
    revisoesPendentes.splice(revisaoAtualIndex, 1);

    if (revisoesPendentes.length > 0) {
      if (revisaoAtualIndex >= revisoesPendentes.length) {
        revisaoAtualIndex = revisoesPendentes.length - 1;
      }
      carregarRevisaoAtual();
      carregarListaRevisoes();
    } else {
      document.getElementById("tituloText").textContent = "Todas as revisões concluídas!";
      document.getElementById("descricao").textContent = "Parabéns! Você completou todas as revisões de hoje.";
      document.getElementById("videoFrame").src = "about:blank";
      document.getElementById("listaRevisoesContainer").classList.add("hidden");
    }

    document.getElementById("contador-revisoes").textContent = `${revisoesPendentes.length} pendentes`;

  } catch (error) {
    console.error("Erro ao marcar como revisado:", error);
    mostrarFeedback("Erro ao marcar como revisado. Tente novamente.", "erro");
  } finally {
    mostrarLoading(false);
  }
}















// 🔹 Agendar nova revisão (CORRIGIDA - campo tipo correto)
async function agendarNovaRevisao() {
  if (!revisaoAtualId || revisoesPendentes.length === 0) return;

  try {
    mostrarLoading(true, "Agendando revisão...");
    await ensureAuth();

    const intervalo = parseInt(document.getElementById('intervalo-revisao').value);
    const revisaoAtual = revisoesPendentes[revisaoAtualIndex];

    const hoje = new Date();
    const dataRevisao = new Date();
    dataRevisao.setDate(hoje.getDate() + intervalo);

    // ⭐⭐ CORREÇÃO: Usar função inteligente para determinar o tipo
    const tipoRevisao = determinarTipoRevisao(revisaoAtual);

    const novaRevisao = {
      videoId: revisaoAtual.videoId,
      titulo: revisaoAtual.titulo,
      // ⭐⭐ CORREÇÃO: Usar o tipo correto (não fixo como "pronuncia")
      tipo: tipoRevisao,
      descricao: revisaoAtual.descricao,
      dataAgendamento: firebase.firestore.Timestamp.fromDate(hoje),
      dataRevisao: firebase.firestore.Timestamp.fromDate(dataRevisao),
      intervaloDias: intervalo,
      realizada: false
    };

    await db.collection('revisoes').add(novaRevisao);
    mostrarFeedback(`Revisão agendada para ${dataRevisao.toLocaleDateString('pt-BR')} 📅`, 'sucesso');

  } catch (error) {
    console.error('Erro ao agendar revisão:', error);
    mostrarFeedback('Erro ao agendar revisão. Tente novamente.', 'erro');
  } finally {
    mostrarLoading(false);
  }
}

// 🔹 Função para determinar o tipo da revisão de forma inteligente
function determinarTipoRevisao(revisao) {
  // Se for conteúdo de verbo/gramática, usar o título como tipo
  if (revisao.titulo && (
      revisao.titulo.toLowerCase().includes('verbo') ||
      revisao.titulo.toLowerCase().includes('verb') ||
      revisao.titulo.toLowerCase().includes('grammar') ||
      revisao.titulo.toLowerCase().includes('gramática') ||
      revisao.titulo.toLowerCase().includes('to be') ||
      revisao.titulo.toLowerCase().includes('to do')
  )) {
    return revisao.titulo;
  }
  
  // Para conteúdos de pronúncia, manter como "pronuncia"
  if (revisao.titulo && (
      revisao.titulo.toLowerCase().includes('Pronúncia') ||
      revisao.titulo.toLowerCase().includes('pronuncia') ||
      revisao.titulo.toLowerCase().includes('pronunciation') ||
      revisao.titulo.toLowerCase().includes('speaking')
  )) {
    return "Pronúncia";
  }
  
  // Para os demais, usar o tipo existente ou título como fallback
  return revisao.tipo || revisao.titulo || "conteúdo";
}







// 🔹 Próxima revisão
function proximaRevisao() {
  if (revisoesPendentes.length === 0) return;

  revisaoAtualIndex = (revisaoAtualIndex + 1) % revisoesPendentes.length;
  carregarRevisaoAtual();
  carregarListaRevisoes();
  mostrarFeedback("Próxima revisão carregada", "info");
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

// 🔹 Tratamento global de erros para garantir que loading sempre fecha
window.addEventListener('error', function() {
  mostrarLoading(false);
});

window.addEventListener('unhandledrejection', function() {
  mostrarLoading(false);
});

// 🔹 Configurar evento do Enter
function configurarEventoEnter() {
  const inputComentario = document.getElementById('inputComentario');
  
  if (!inputComentario) return;
  
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

// 🔹 Restaurar botão de comentário para estado normal
function restaurarBotaoComentario() {
  const btnComentario = document.getElementById('btnComentario');
  if (!btnComentario) return;
  
  const novoBtn = btnComentario.cloneNode(true);
  btnComentario.parentNode.replaceChild(novoBtn, btnComentario);
  
  novoBtn.innerHTML = '➕';
  novoBtn.onclick = function(e) {
    e.preventDefault();
    adicionarComentario();
    return false;
  };
}




// 🔹 Função para determinar o texto a ser mostrado (tipo ou título)
function determinarTextoRevisao(revisao) {
  // Se for um verbo ou conteúdo específico, mostrar o título
  if (revisao.titulo && (
      revisao.titulo.toLowerCase().includes('verbo') ||
      revisao.titulo.toLowerCase().includes('verb') ||
      revisao.titulo.toLowerCase().includes('to do') ||
      revisao.titulo.toLowerCase().includes('grammar') ||
      revisao.titulo.toLowerCase().includes('gramática')
  )) {
    return revisao.titulo;
  }
  
  // Para os demais, usar o tipo (se existir) ou título como fallback
  return revisao.tipo || revisao.titulo;
}






// Inicializar a página
document.addEventListener('DOMContentLoaded', async function() {
  console.log('DOM carregado, iniciando página de revisão...');
  
  // Configurar evento do Enter
  configurarEventoEnter();
  
  // Configurar botões principais
  const btnMarcarRevisado = document.getElementById('btn-marcar-revisado');
  const btnProximo = document.getElementById('btn-proximo');
  const btnAgendar = document.getElementById('btn-agendar');
  const btnComentario = document.getElementById('btnComentario');
  
  // Configurar evento do botão de comentário
  if (btnComentario) {
    btnComentario.onclick = function(e) {
      e.preventDefault();
      if (comentarioEditando) {
        const texto = document.getElementById('inputComentario').value.trim();
        if (texto) editarComentario(comentarioEditando, texto);
      } else {
        adicionarComentario();
      }
      return false;
    };
  }
  
  // Configurar outros botões
  if (btnMarcarRevisado) {
    btnMarcarRevisado.addEventListener('click', marcarComoRevisado);
  }
  
  if (btnProximo) {
    btnProximo.addEventListener('click', proximaRevisao);
  }
  
  if (btnAgendar) {
    btnAgendar.addEventListener('click', agendarNovaRevisao);
  }

  // Configurar botão de força fechar loading
  setupForceCloseButton();
  
  // Carregar revisões do dia
  console.log('Carregando revisões...');
  await carregarRevisoesDoDia();
  console.log('Revisões carregadas!');
});