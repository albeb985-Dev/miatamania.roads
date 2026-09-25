document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const routeId = params.get('id');

    if (!routeId) {
        document.getElementById('loading').innerText = 'Nessun percorso specificato.';
        return;
    }

    fetch('data/routes.json')
        .then(res => res.json())
        .then(routes => {
            const route = routes.find(r => r.id === routeId);
            if (!route) {
                document.getElementById('loading').innerText = 'Percorso non trovato.';
                return;
            }
            initRouteDetail(route);
        });

    function initRouteDetail(route) {
        document.getElementById('routeTitle').innerText = route.title;
        document.getElementById('routeDescription').innerText = route.description;
        const badge = document.getElementById('routeBadge');
        badge.innerText = route.difficulty;
        badge.classList.add(route.difficulty.toLowerCase());

        document.getElementById('downloadGpxBtn').href = route.gpx_file;

        const map = L.map('map').setView([0, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        fetch(route.gpx_file)
            .then(res => res.text())
            .then(xmlString => {
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlString, "text/xml");
                const trkpts = xmlDoc.querySelectorAll('trkpt');

                const points = [];
                const elevations = [];
                const labels = [];
                let totalDistance = 0, eleGain = 0, eleLoss = 0;
                let maxEle = -Infinity, minEle = Infinity;
                let lastLat = null, lastLon = null, lastEle = null;

                trkpts.forEach((pt) => {
                    const lat = parseFloat(pt.getAttribute('lat'));
                    const lon = parseFloat(pt.getAttribute('lon'));
                    const eleNode = pt.querySelector('ele');
                    const ele = eleNode ? parseFloat(eleNode.textContent) : 0;

                    points.push([lat, lon]);

                    if (lastLat !== null && lastLon !== null) {
                        const dist = calculateDistance(lastLat, lastLon, lat, lon);
                        totalDistance += dist;

                        const diff = ele - lastEle;
                        if (diff > 0) eleGain += diff;
                        else eleLoss += Math.abs(diff);
                    }

                    if (ele > maxEle) maxEle = ele;
                    if (ele < minEle) minEle = ele;

                    lastLat = lat; lastLon = lon; lastEle = ele;
                    elevations.push(ele);
                    labels.push(totalDistance.toFixed(1) + ' km');
                });

                const polyline = L.polyline(points, { color: '#2563eb', weight: 4 }).addTo(map);
                map.fitBounds(polyline.getBounds());

                if (points.length > 0) {
                    const [startLat, startLon] = points[0];
                    document.getElementById('googleMapsBtn').href = `https://www.google.com/maps/dir/?api=1&destination=${startLat},${startLon}`;
                    L.marker([startLat, startLon]).addTo(map).bindPopup('Punto di partenza');
                }

                document.getElementById('statDistance').innerText = totalDistance.toFixed(2) + ' km';
                document.getElementById('statEleGain').innerText = Math.round(eleGain) + ' m';
                document.getElementById('statEleLoss').innerText = Math.round(eleLoss) + ' m';
                document.getElementById('statMaxEle').innerText = Math.round(maxEle) + ' m';
                document.getElementById('statMinEle').innerText = Math.round(minEle) + ' m';

                document.getElementById('loading').classList.add('hidden');
                document.getElementById('routeContent').classList.remove('hidden');

                renderChart(labels, elevations);
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
        const ctx = document.getElementById('elevationChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Altitudine (m)',
                    data: elevations,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { maxTicksLimit: 10 } },
                    y: { title: { display: true, text: 'Metri (m)' } }
                }
            }
        });
    }
});