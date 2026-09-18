let produtores = [];
const URL_PRODUTORES_COMPARTILHADOS = 'file:///D:/PROJETOS/pedagio-auto/dados-compartilhados/produtores-km.json';

fetch(URL_PRODUTORES_COMPARTILHADOS)
  .then(response => {
    if (!response.ok) {
      throw new Error(`Falha ao carregar a base (${response.status})`);
    }

    return response.json();
  })
  .then(data => {
    produtores = Array.isArray(data) ? data : (data.produtores || []);
  })
  .catch(error => {
    console.error('Erro ao carregar dados:', error);
    resultsDiv.innerHTML = '<p class="no-results">Nao foi possivel carregar a base compartilhada.</p>';
    alert([
      'Nao foi possivel carregar a base compartilhada de produtores.',
      '',
      `Caminho configurado: ${URL_PRODUTORES_COMPARTILHADOS}`,
      '',
      'Corrija URL_PRODUTORES_COMPARTILHADOS em:',
      'extensao-chrome-integrados/popup.js',
      '',
      "Depois habilite 'Permitir acesso a URLs de arquivo' e recarregue a extensao."
    ].join('\n'));
  });

// Elementos do DOM
const searchInput = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');

// Event listener para busca
searchInput.addEventListener('input', function() {
  const searchTerm = this.value.toLowerCase().trim();
  
  if (searchTerm === '') {
    resultsDiv.innerHTML = '';
    return;
  }
  
  // Filtrar produtores
  const filtered = produtores.filter(produtor =>
    nomeCompletoProdutor(produtor).toLowerCase().includes(searchTerm)
  );
  
  // Exibir resultados
  displayResults(filtered);
});

function displayResults(results) {
  if (results.length === 0) {
    resultsDiv.innerHTML = '<p class="no-results">Nenhum produtor encontrado</p>';
    return;
  }
  
  let html = '<ul class="results-list">';
  results.forEach(produtor => {
    const nome = escapeHtml(nomeCompletoProdutor(produtor));
    const municipio = escapeHtml(produtor.municipio || 'Cidade não informada');
    const distancia = produtor.distancia ?? '';
    const coordenadas = produtor.coordenadas || '';

    html += `
      <li class="result-item">
        <div class="produtor-info">
          <span class="produtor-name">${nome}</span>
          <span class="produtor-city">${municipio}</span>
          <span class="produtor-cood">${coordenadas}</span>
        </div>
        <span class="km-value">${distancia} km</span>
      </li>
    `;
  });
  html += '</ul>';
  
  resultsDiv.innerHTML = html;
}

function nomeCompletoProdutor(produtor) {
  return [produtor.produtor, produtor.aviario]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
