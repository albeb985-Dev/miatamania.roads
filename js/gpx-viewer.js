document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const routeId = params.get('id');

    const loadingEl = document.getElementById('loading');

    if (!routeId) {
        if (loadingEl) loadingEl.innerHTML = '<div class="alert alert-warning max-w-600 mx-auto">Nessun percorso specificato nell\'URL.</div>';
        return;
    }

    fetch('data/routes.json')
        .then(res => {
            if (!res.ok) throw new Error("Errore nel caricamento del file JSON dei percorsi.");
            return res.json();
        })
        .then(routes => {
            const route = routes.find(r => r.id === routeId);
            if (!route) {
                if (loadingEl) loadingEl.innerHTML = '<div class="alert alert-danger max-w-600 mx-auto">Percorso non trovato nel database.</div>';
                return;
            }
            initRouteDetail(route);
        })
        .catch(err => {
            console.error('Errore:', err);
            if (loadingEl) loadingEl.innerHTML = `<div class="alert alert-danger max-w-600 mx-auto">${err.message}</div>`;
        });

    function getBadgeClass(diff) {
        switch(diff.toLowerCase()) {
            case 'percorsi': return 'badge-percorsi';
            case 'raduni': return 'badge-raduni';
            case 'poi': return 'badge-poi';
            default: return 'bg-secondary text-white';
        }
    }

    function initRouteDetail(route) {
        document.getElementById('routeTitle').innerText = route.title || 'Percorso';
        document.getElementById('routeDescription').innerText = route.description || '';
        
        const badge = document.getElementById('routeBadge');
        badge.innerText = route.category || 'N/D';
        badge.className = `badge ${getBadgeClass(route.category)} px-3 py-2 rounded-pill fs-6 mb-2`;

        document.getElementById('downloadGpxBtn').href = route.gpx_file;

        // Inizializza Mappa Leaflet
        const map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Get Info File
        fetch(`files/routeinfo/${routeId}.json`)
        .then(response => response.json())
        .then(data => {
            // Carica il tracciato GPX sulla mappa
            if (data.gpxFile) {
            loadGpxTrack(data.gpx_file, map);
            }

            if (data.pois && Array.isArray(data.pois)) {
            renderRoutePois(data.pois, map);           
            }
        })
        .catch(err => console.error('Errore nel caricamento del file routeinfo:', err));
    }

    function loadGpxTrack(gpxfile,map)
    {
        fetch(gpxfile)
            .then(res => {
                if (!res.ok) throw new Error(`File GPX non trovato al percorso: ${route.gpx_file}`);
                return res.text();
            })
            .then(xmlString => {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlString, "text/xml");
                
                // Cerca trkpt, rtept o wpt per la massima tolleranza del formato
                let trkpts = xmlDoc.querySelectorAll('trkpt');
                if (trkpts.length === 0) trkpts = xmlDoc.querySelectorAll('rtept');
                if (trkpts.length === 0) trkpts = xmlDoc.querySelectorAll('wpt');

                if (trkpts.length === 0) {
                    throw new Error("Il file GPX non contiene coordinate valide (<trkpt>, <rtept> o <wpt>).");
                }

                const points = [];
                const elevations = [];
                const labels = [];
                let totalDistance = 0, eleGain = 0, eleLoss = 0;
                let maxEle = -Infinity, minEle = Infinity;
                let lastLat = null, lastLon = null, lastEle = null;
                let hasElevationData = false;

                trkpts.forEach((pt) => {
                    const lat = parseFloat(pt.getAttribute('lat'));
                    const lon = parseFloat(pt.getAttribute('lon'));
                    
                    if (isNaN(lat) || isNaN(lon)) return; // Salta eventuali punti non validi

                    const eleNode = pt.querySelector('ele');
                    let ele = null;
                    if (eleNode && !isNaN(parseFloat(eleNode.textContent))) {
                        ele = parseFloat(eleNode.textContent);
                        hasElevationData = true;
                    }

                    points.push([lat, lon]);

                    if (lastLat !== null && lastLon !== null) {
                        const dist = calculateDistance(lastLat, lastLon, lat, lon);
                        totalDistance += dist;

                        if (ele !== null && lastEle !== null) {
                            const diff = ele - lastEle;
                            if (diff > 0) eleGain += diff;
                            else eleLoss += Math.abs(diff);
                        }
                    }

                    if (ele !== null) {
                        if (ele > maxEle) maxEle = ele;
                        if (ele < minEle) minEle = ele;
                    }

                    lastLat = lat; 
                    lastLon = lon; 
                    lastEle = ele;
                    
                    elevations.push(ele !== null ? ele : 0);
                    labels.push(totalDistance.toFixed(1) + ' km');
                });

                if (points.length === 0) {
                    throw new Error("Impossibile estrarre coordinate geografiche valide dal file GPX.");
                }

                // Disegna il tracciato sulla mappa
                const polyline = L.polyline(points, { color: '#0d6efd', weight: 5, opacity: 0.8 }).addTo(map);
                map.fitBounds(polyline.getBounds(), { padding: [30, 30] });

                const [startLat, startLon] = points[0];
                document.getElementById('googleMapsBtn').href = `https://www.google.com/maps/dir/?api=1&destination=${startLat},${startLon}`;
                
                L.marker([startLat, startLon]).addTo(map).bindPopup('<b>Inizio Percorso</b><br>' + route.title).openPopup();

                // Dati tecnici in sidebar
                document.getElementById('statDistance').innerText = totalDistance.toFixed(2) + ' km';
                document.getElementById('statEleGain').innerText = hasElevationData ? '+' + Math.round(eleGain) + ' m' : 'N/D';
                document.getElementById('statEleLoss').innerText = hasElevationData ? '-' + Math.round(eleLoss) + ' m' : 'N/D';
                document.getElementById('statMaxEle').innerText = (hasElevationData && maxEle !== -Infinity) ? Math.round(maxEle) + ' m' : 'N/D';
                document.getElementById('statMinEle').innerText = (hasElevationData && minEle !== Infinity) ? Math.round(minEle) + ' m' : 'N/D';

                // Mostra la pagina
                if (loadingEl) loadingEl.classList.add('d-none');
                document.getElementById('routeContent').classList.remove('d-none');

                // Renderizza il grafico o mostra un avviso se mancano i dati d'altitudine
                if (hasElevationData) {
                    renderChart(labels, elevations);
                } else {
                    const chartCanvas = document.getElementById('elevationChart');
                    if (chartCanvas && chartCanvas.parentElement) {
                        chartCanvas.parentElement.innerHTML = `
                            <div class="alert alert-warning text-center my-3" role="alert">
                                <i class="bi bi-info-circle-fill me-2"></i>
                                <strong>Dati altimetrici non disponibili:</strong> Questo file GPX non contiene le informazioni di quota (tag <code>&lt;ele&gt;</code>). Il tracciato sulla mappa è stato comunque generato correttamente.
                            </div>`;
                    }
                }
            })
            .catch(err => {
                console.error("Errore GPX:", err);
                if (loadingEl) {
                    loadingEl.innerHTML = `<div class="alert alert-danger max-w-600 mx-auto">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> Errore durante l'elaborazione del tracciato: <br><code>${err.message}</code>
                    </div>`;
                }
            });
    }

    // Funzione 1: Genera il marker Leaflet personalizzato
    function createPoiMarker(poi) {
    let symbol = '📍';
    let badgeClass = 'poi-waypoint';

    if (poi.category === 'Ristorante') {
        symbol = '🍽️';
        badgeClass = 'poi-restaurant';
    } else if (poi.category === 'Sosta') {
        symbol = poi.order ? poi.order : 'P';
        badgeClass = 'poi-stop';
    } else if (poi.category === 'Punto di Passaggio') {
        symbol = poi.order ? poi.order : '•';
        badgeClass = 'poi-waypoint';
    }

    const customIcon = L.divIcon({
        className: `custom-poi-icon ${badgeClass}`,
        html: `<span>${symbol}</span>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const marker = L.marker([poi.lat, poi.lng], { icon: customIcon });

    const popupContent = `
        <div class="poi-popup">
        <span class="poi-badge ${badgeClass}">${poi.category}</span>
        ${poi.order ? `<span class="poi-order-badge">#${poi.order}</span>` : ''}
        <h4>${poi.name}</h4>
        <p>${poi.description || ''}</p>
        </div>
    `;

    marker.bindPopup(popupContent);
    return marker;
    }

    // Funzione 2: Ordina i POI, crea i marker e popola la lista HTML
    function renderRoutePois(pois, map) {
    // Ordina Soste e Punti di Passaggio per 'order'
    const sortedPois = [...pois].sort((a, b) => {
        if (a.order && b.order) return a.order - b.order;
        if (a.order) return -1;
        if (b.order) return 1;
        return 0;
    });

    const poiContainer = document.getElementById('route-poi-list');
    if (poiContainer) poiContainer.innerHTML = '';

    sortedPois.forEach(poi => {
        // 1. Aggiunge il marker sulla mappa
        const marker = createPoiMarker(poi).addTo(map);

        // 2. Popola l'elemento nella lista in pagina (se presente)
        if (poiContainer) {
        const poiCard = document.createElement('div');
        poiCard.className = 'poi-card-item';
        poiCard.innerHTML = `
            <div class="poi-card-header">
            ${poi.order ? `<span class="poi-order-number">${poi.order}</span>` : ''}
            <div>
                <strong>${poi.name}</strong>
                <small class="poi-category-label">${poi.category}</small>
            </div>
            </div>
        `;

        // Cliccando sul POI in lista, la mappa si centra sul punto
        poiCard.addEventListener('click', () => {
            map.flyTo([poi.lat, poi.lng], 15);
            marker.openPopup();
        });

        poiContainer.appendChild(poiCard);
        }
    });
    }

    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    function renderChart(labels, elevations) {
        const chartEl = document.getElementById('elevationChart');
        if (!chartEl) return;
        const ctx = chartEl.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(13, 110, 253, 0.35)');
        gradient.addColorStop(1, 'rgba(13, 110, 253, 0.0)');

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Quota (m)',
                    data: elevations,
                    borderColor: '#0d6efd',
                    borderWidth: 2.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxTicksLimit: 8 }
                    },
                    y: {
                        grid: { color: '#f1f5f9' },
                        title: { display: true, text: 'Altitudine (metri)' }
                    }
                }
            }
        });
    }
});