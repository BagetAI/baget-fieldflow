document.addEventListener('DOMContentLoaded', async () => {
    const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
    const FARMS_DB_ID = '9b5c711f-8906-4325-8fa5-079aa23dc9de';
    
    const container = document.getElementById('inventory-container');
    const produceFilter = document.getElementById('produce-filter');
    const dateFilter = document.getElementById('date-filter');
    const resetBtn = document.getElementById('reset-filters');

    let allListings = [];
    let allFarms = {};

    const fetchData = async () => {
        try {
            // Fetch farms first to create a lookup map
            const farmsRes = await fetch(`https://baget.ai/api/public/databases/${FARMS_DB_ID}/rows`);
            if (farmsRes.ok) {
                const farms = await farmsRes.json();
                farms.forEach(f => {
                    // Using lowercase name or a simulated ID as key
                    allFarms[f.name.toUpperCase()] = f;
                });
            }

            // Fetch listings
            const listingsRes = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`);
            if (listingsRes.ok) {
                allListings = await listingsRes.json();
                renderInventory(allListings);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            container.innerHTML = '<div class="empty-state">ERROR_SYNCING_DATA. RETRY_LATER.</div>';
        }
    };

    const renderInventory = (listings) => {
        if (listings.length === 0) {
            container.innerHTML = '<div class="empty-state">NO_MATCHING_SURPLUS_FOUND.</div>';
            return;
        }

        container.innerHTML = listings.map(row => {
            const isReserved = row.status === 'Reserved' || row.status === 'Sold';
            const farmName = row.farm_id || 'LOCAL ANCHOR FARM';
            const farmData = allFarms[farmName.toUpperCase()] || { location: 'REGIONAL HUB' };

            return `
                <div class="brutal-card ${isReserved ? 'reserved' : ''}">
                    <span class="card-tag" style="background: ${isReserved ? 'var(--slate)' : 'var(--brutal-yellow)'}">
                        ${isReserved ? 'STATUS: UNAVAILABLE' : 'STATUS: READY_FOR_PICKUP'}
                    </span>
                    <h3 class="card-title">${row.produce_type.toUpperCase()}</h3>
                    <div class="card-meta">
                        <span>QTY: ${row.quantity} LBS</span>
                        <span class="price-tag">${row.price}/LB</span>
                    </div>
                    <div class="farm-info">
                        PRODUCER: ${farmName}<br>
                        LOCATION: ${farmData.location}
                    </div>
                    <div style="font-size: 12px; font-weight: 800; opacity: 0.5; margin-top: 20px;">
                        HARVESTED: ${new Date(row.harvest_date).toLocaleDateString()} @ ${new Date(row.harvest_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                    <a href="/index.html#live" class="brutal-btn brutal-btn-sm w-full" style="margin-top: 30px; text-decoration: none; text-align: center;">
                        ${isReserved ? 'VIEW_ARCHIVE' : 'CLAIM_NOW'}
                    </a>
                </div>
            `;
        }).join('');
    };

    const filterListings = () => {
        const produceVal = produceFilter.value.toLowerCase();
        const dateVal = dateFilter.value;

        const filtered = allListings.filter(l => {
            const matchesProduce = l.produce_type.toLowerCase().includes(produceVal);
            const matchesDate = !dateVal || l.harvest_date.startsWith(dateVal);
            return matchesProduce && matchesDate;
        });

        renderInventory(filtered);
    };

    produceFilter.addEventListener('input', filterListings);
    dateFilter.addEventListener('change', filterListings);
    
    resetBtn.addEventListener('click', () => {
        produceFilter.value = '';
        dateFilter.value = '';
        renderInventory(allListings);
    });

    fetchData();
});
