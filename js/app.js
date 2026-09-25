document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('routesGrid');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    let allRoutes = [];

    fetch('data/routes.json')
        .then(res => res.json())
        .then(routes => {
            allRoutes = routes;
            renderRoutes(allRoutes);
        })
        .catch(err => {
            console.error('Errore caricamento percorsi:', err);
            grid.innerHTML = `<div class="col-12"><div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle-fill me-2"></i> Impossibile caricare il catalogo percorsi.
            </div></div>`;
        });

    function getBadgeClass(diff) {
        switch(diff.toLowerCase()) {
            case 'percorsi': return 'badge-percorsi';
            case 'raduni': return 'badge-raduni';
            case 'poi': return 'badge-poi';
            default: return 'bg-secondary text-white';
        }
    }

    function renderRoutes(routes) {
        grid.innerHTML = '';
        if (routes.length === 0) {
            grid.innerHTML = `<div class="col-12 text-center py-5">
                <i class="bi bi-search text-muted display-4 d-block mb-3"></i>
                <p class="h5 text-muted">Nessun percorso trovato con questi criteri.</p>
            </div>`;
            return;
        }

        routes.forEach(route => {
            const col = document.createElement('div');
            col.className = 'col';
            col.innerHTML = `
                <div class="card h-100 border-0 shadow-sm rounded-4 route-card-hover overflow-hidden">
                    <div class="card-body p-4 d-flex flex-column">
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <span class="badge ${getBadgeClass(route.category)} px-3 py-2 rounded-pill fw-semibold">
                                ${route.category}
                            </span>
                            <span class="text-muted small"><i class="bi bi-geo-alt text-primary me-1"></i> GPX</span>
                        </div>
                        <h4 class="card-title fw-bold text-dark mb-2">${route.title}</h4>
                        <p class="card-text text-muted small mb-4 flex-grow-1">${route.description}</p>
                        
                        <div class="p-3 bg-light rounded-3 d-flex justify-content-around text-center mb-3 border">
                            <div>
                                <small class="text-muted d-block"><i class="bi bi-ruler me-1"></i> Distanza</small>
                                <strong class="text-dark">${route.distance_km} km</strong>
                            </div>
                            <div class="border-start"></div>
                            <div>
                                <small class="text-muted d-block"><i class="bi bi-arrow-up-right-circle text-success me-1"></i> Dislivello</small>
                                <strong class="text-dark">+${route.elevation_gain_m} m</strong>
                            </div>
                        </div>

                        <a href="percorso.html?id=${route.id}" class="btn btn-outline-primary rounded-3 w-100 fw-semibold">
                            Visualizza Scheda <i class="bi bi-chevron-right ms-1"></i>
                        </a>
                    </div>
                </div>
            `;
            grid.appendChild(col);
        });
    }

    function filterRoutes() {
        const query = searchInput.value.toLowerCase();
        const diff = categoryFilter.value;

        const filtered = allRoutes.filter(r => {
            const matchesQuery = r.title.toLowerCase().includes(query) || r.description.toLowerCase().includes(query);
            const matchesDiff = diff === 'all' || r.category.toLowerCase() === diff.toLowerCase();
            return matchesQuery && matchesDiff;
        });

        renderRoutes(filtered);
    }

    if (searchInput && categoryFilter) {
        searchInput.addEventListener('input', filterRoutes);
        categoryFilter.addEventListener('change', filterRoutes);
    }
});