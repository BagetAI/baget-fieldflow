document.addEventListener('DOMContentLoaded', () => {
    const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
    const WAITLIST_DB_ID = 'e32f6392-951a-4b08-92a0-6425257c24a4';

    // --- 1. LIVE SURPLUS DATA FETCHING & RENDERING ---
    const updateSurplusData = async () => {
        const counterEl = document.getElementById('surplus-count');
        const tickerEl = document.getElementById('live-ticker');
        const gridEl = document.getElementById('listings-grid');
        
        try {
            const response = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`);
            if (response.ok) {
                const rows = await response.json();
                
                // 1a. Update Hero Stats
                const totalLbs = rows
                    .filter(r => r.status === 'Available')
                    .reduce((sum, row) => sum + (parseFloat(row.quantity) || 0), 0);
                if (counterEl) counterEl.innerText = `${Math.floor(totalLbs)}lbs`;

                // 1b. Update Ticker
                if (tickerEl) {
                    const availableRows = rows.filter(r => r.status === 'Available');
                    if (availableRows.length > 0) {
                        const recent = availableRows.slice(-5).reverse();
                        tickerEl.innerHTML = recent.map(r => 
                            `<span class="ticker-item">SURPLUS ALERT: ${r.quantity}lb ${r.produce_type} available now</span>`
                        ).join('');
                    } else {
                        tickerEl.innerHTML = 'Spring Surge Pending - Secure your spot in the beta for first alerts.';
                    }
                }

                // 1c. Render Grid
                if (gridEl) {
                    const activeRows = rows.filter(r => r.status !== 'Sold');
                    if (activeRows.length > 0) {
                        gridEl.innerHTML = activeRows.map(row => {
                            const isReserved = row.status === 'Reserved';
                            return `
                                <div class="listing-card-preview ${isReserved ? 'reserved' : ''}">
                                    <span class="badge-live ${isReserved ? 'bg-slate' : ''}">${isReserved ? 'Reserved' : 'Live Now'}</span>
                                    <h3 class="listing-title">${row.produce_type}</h3>
                                    <div class="listing-meta">
                                        <span>Quantity: ${row.quantity} lbs</span>
                                        <span class="listing-price">${row.price}/lb</span>
                                    </div>
                                    <div class="listing-time">Harvested: ${new Date(row.harvest_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} today</div>
                                    <button 
                                        class="btn-primary w-full checkout-btn" 
                                        data-produce="${row.produce_type}" 
                                        data-price="${row.price}" 
                                        data-quantity="${row.quantity}"
                                        ${isReserved ? 'disabled' : ''}
                                    >
                                        ${isReserved ? 'Transaction Pending' : 'Claim Surplus'}
                                    </button>
                                </div>
                            `;
                        }).join('');
                        
                        // Attach listeners to checkout buttons
                        document.querySelectorAll('.checkout-btn').forEach(btn => {
                            btn.addEventListener('click', async () => {
                                const produce = btn.dataset.produce;
                                const price = btn.dataset.price;
                                const quantity = btn.dataset.quantity;
                                await initiateCheckout(produce, price, quantity);
                            });
                        });
                    } else {
                        gridEl.innerHTML = '<div class="text-white">Waiting for next harvest listing... Check back in 1 hour.</div>';
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching surplus stats:', error);
        }
    };

    const initiateCheckout = async (produce_type, price, quantity) => {
        const btn = document.querySelector(`.checkout-btn[data-produce="${produce_type}"]`);
        if (btn) {
            btn.innerText = 'Initializing Stripe...';
            btn.disabled = true;
        }

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    produce_type,
                    price,
                    quantity,
                    listingId: produce_type // Using produce_type as ID for demo
                })
            });

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                alert('Checkout failed: ' + (data.error || 'Unknown error'));
                if (btn) {
                    btn.innerText = 'Claim Surplus';
                    btn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Connection error. Please try again.');
            if (btn) {
                btn.innerText = 'Claim Surplus';
                btn.disabled = false;
            }
        }
    };

    updateSurplusData();

    // --- 3. SELLER PORTAL: POST SURPLUS FORM ---
    const surplusForm = document.getElementById('surplus-form');
    if (surplusForm) {
        surplusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = surplusForm.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = 'Publishing...';
            btn.disabled = true;

            const formData = {
                produce_type: document.getElementById('produce_type').value,
                quantity: document.getElementById('quantity').value,
                price: document.getElementById('price').value,
                harvest_date: document.getElementById('harvest_date').value,
                status: 'Available'
            };

            try {
                const response = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        rows: [{
                            externalKey: formData.produce_type,
                            data: formData 
                        }]
                    })
                });

                if (response.ok) {
                    document.getElementById('form-container').classList.add('hidden');
                    document.getElementById('post-success').classList.remove('hidden');
                    updateSurplusData();
                } else {
                    throw new Error('Listing failed');
                }
            } catch (err) {
                alert('Error publishing listing. Please try again.');
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }

    // --- 4. MAIN WAITLIST FORM ---
    const betaForm = document.getElementById('beta-form');
    if (betaForm) {
        betaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = betaForm.querySelector('button');
            submitBtn.innerText = 'Syncing...';
            submitBtn.disabled = true;

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                role: document.getElementById('role').value,
                location: document.getElementById('location').value
            };

            try {
                const response = await fetch(`https://baget.ai/api/public/databases/${WAITLIST_DB_ID}/rows`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: formData }),
                });

                if (response.ok) {
                    betaForm.classList.add('hidden');
                    document.getElementById('form-success').classList.remove('hidden');
                }
            } catch (error) {
                submitBtn.innerText = 'Join the Beta';
                submitBtn.disabled = false;
                alert('Submission failed.');
            }
        });
    }

    // --- 5. SMOOTH SCROLL ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            if (this.hash) {
                e.preventDefault();
                const target = document.querySelector(this.hash);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
});
