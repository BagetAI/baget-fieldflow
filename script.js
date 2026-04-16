document.addEventListener('DOMContentLoaded', () => {
    const LISTINGS_DB_ID = 'eaa7a6ac-fa48-4674-b788-ce22410b8a04';
    const WAITLIST_DB_ID = 'e32f6392-951a-4b08-92a0-6425257c24a4';

    // --- 1. LIVE SURPLUS COUNTER (Landing Page) ---
    const updateSurplusCounter = async () => {
        const counterEl = document.getElementById('surplus-count');
        const tickerEl = document.getElementById('live-ticker');
        if (!counterEl && !tickerEl) return;

        try {
            const response = await fetch(`https://baget.ai/api/public/databases/${LISTINGS_DB_ID}/rows`);
            if (response.ok) {
                const rows = await response.json();
                
                // Calculate total weight (lbs)
                const totalLbs = rows.reduce((sum, row) => sum + (parseFloat(row.quantity) || 0), 0);
                
                if (counterEl) {
                    counterEl.innerText = `${Math.floor(totalLbs)}lbs`;
                }

                if (tickerEl && rows.length > 0) {
                    // Show last 3 listings in ticker
                    const recent = rows.slice(-3).reverse();
                    tickerEl.innerHTML = recent.map(r => 
                        `<span class="ticker-item">NEW: ${r.quantity}lb ${r.produce_type} just listed</span>`
                    ).join(' | ');
                }
            }
        } catch (error) {
            console.error('Error fetching surplus stats:', error);
        }
    };

    updateSurplusCounter();

    // --- 2. SELLER PORTAL: POST SURPLUS FORM ---
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
                    body: JSON.stringify({ data: formData })
                });

                if (response.ok) {
                    document.getElementById('form-container').classList.add('hidden');
                    document.getElementById('post-success').classList.remove('hidden');
                    // Refresh count in background
                    updateSurplusCounter();
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

    // --- 3. WAITLIST FORM (Existing) ---
    const betaForm = document.getElementById('beta-form');
    const formSuccess = document.getElementById('form-success');

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
                    formSuccess.classList.remove('hidden');
                }
            } catch (error) {
                submitBtn.innerText = 'Join the Beta';
                submitBtn.disabled = false;
                alert('Submission failed.');
            }
        });
    }

    // --- 4. UTILITIES ---
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
