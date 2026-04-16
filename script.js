document.addEventListener('DOMContentLoaded', () => {
    // 1. Simple A/B Testing for Hero CTA
    const heroCta = document.getElementById('hero-cta');
    const heroHeading = document.getElementById('hero-heading');
    
    const variants = [
        { cta: 'Join the Beta', heading: 'Fresh From the Field, <span class="text-coral">In Your Kitchen Today.</span>' },
        { cta: 'Rescue Your First Harvest', heading: 'Turn Your Farm Surplus <span class="text-coral">Into Profit Today.</span>' }
    ];

    // Simple randomization for demo/prototype purposes
    const selectedVariant = variants[Math.floor(Math.random() * variants.length)];
    
    if (heroCta && heroHeading) {
        // heroCta.innerText = selectedVariant.cta; // Disabled for now to keep consistency with "Join the Beta" requirement
        // heroHeading.innerHTML = selectedVariant.heading;
    }

    // 2. Form Submission Logic
    const betaForm = document.getElementById('beta-form');
    const formSuccess = document.getElementById('form-success');
    const dbId = 'e32f6392-951a-4b08-92a0-6425257c24a4'; // FieldFlow_Waitlist

    if (betaForm) {
        betaForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const submitBtn = betaForm.querySelector('button');
            const originalBtnText = submitBtn.innerText;
            submitBtn.innerText = 'Syncing...';
            submitBtn.disabled = true;

            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                role: document.getElementById('role').value,
                location: document.getElementById('location').value
            };

            // Track event (mock)
            console.log('Tracking Event: Waitlist_Signup_Attempt', formData);

            try {
                const response = await fetch(`https://baget.ai/api/public/databases/${dbId}/rows`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ data: formData }),
                });

                if (response.ok) {
                    betaForm.classList.add('hidden');
                    formSuccess.classList.remove('hidden');
                    
                    // Track success
                    console.log('Tracking Event: Waitlist_Signup_Success');
                } else {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to submit');
                }
            } catch (error) {
                console.error('Submission error:', error);
                alert('Oops! Something went wrong. Please check your connection and try again.');
                submitBtn.innerText = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    // 3. Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // 4. Simple Scroll Animation for items
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    document.querySelectorAll('.section-text, .section-image').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });
});
